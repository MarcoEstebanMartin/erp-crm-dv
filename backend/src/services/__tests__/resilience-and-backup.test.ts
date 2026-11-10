import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import {
  decryptAndDecompressBackup,
  encryptAndCompressBackup,
  pruneOldEncryptedBackups,
} from '../../utils/encrypted-backup.util';
import {
  executeWithResilientRetry,
  ResilientAsyncQueue,
} from '../../utils/resilient-retry-queue.util';
import { isTransientExternalError } from '../resilience/external-integrations-retry.service';
import * as afipService from '../afip.service';
import { resolveAfipCaeOrContingency } from '../orders/order-cae-deferred.helper';

describe('Paso S6 — Cola Resiliente (AFIP / WhatsApp) y Backups Cifrados AES-256-GCM', () => {
  it('reintenta fallos transitorios 503/timeout y corta de inmediato ante errores fiscales 400', async () => {
    let attempts = 0;
    const recovered = await executeWithResilientRetry(
      async () => {
        attempts++;
        if (attempts < 3) {
          const transient: any = new Error('ARCA WSFE 503 Service Unavailable');
          transient.statusCode = 503;
          throw transient;
        }
        return { cae: '74123456789012' };
      },
      { maxAttempts: 4, baseDelayMs: 5, maxDelayMs: 20, isRetryable: isTransientExternalError },
    );

    expect(recovered.cae).toBe('74123456789012');
    expect(attempts).toBe(3);

    let badInputCalls = 0;
    await expect(
      executeWithResilientRetry(
        async () => {
          badInputCalls++;
          throw new Error('Error AFIP 10015: CUIT inválido para Factura A');
        },
        { maxAttempts: 4, baseDelayMs: 5, isRetryable: isTransientExternalError },
      ),
    ).rejects.toThrow(/CUIT inválido/);
    expect(badInputCalls).toBe(1);
  });

  it('deduplica tareas en ResilientAsyncQueue, aplica backoff y ejecuta onPermanentFailure al agotar', async () => {
    const queue = new ResilientAsyncQueue(2, 0);
    let runs = 0;

    let resolveDone!: () => void;
    const donePromise = new Promise<void>((r) => {
      resolveDone = r;
    });

    const first = queue.enqueue({
      key: 'wa-msg:501',
      label: 'Test WA Retry',
      maxAttempts: 3,
      baseDelayMs: 8,
      maxDelayMs: 25,
      run: async () => {
        runs++;
        if (runs < 2) throw new TypeError('fetch failed');
        resolveDone();
      },
    });
    const duplicate = queue.enqueue({
      key: 'wa-msg:501',
      label: 'Duplicate WA Retry',
      run: async () => {},
    });

    expect(first).toBe(true);
    expect(duplicate).toBe(false);

    await donePromise;
    await new Promise((r) => setTimeout(r, 10));
    expect(runs).toBe(2);
    expect(queue.getStats().completed).toBe(1);

    let permanentFailedAttempts = 0;
    let resolveFail!: () => void;
    const failPromise = new Promise<void>((r) => {
      resolveFail = r;
    });

    queue.enqueue({
      key: 'wa-msg:999',
      label: 'Permanent Fail WA',
      maxAttempts: 2,
      baseDelayMs: 5,
      run: async () => {
        throw new TypeError('ECONNRESET');
      },
      onPermanentFailure: (_err, att) => {
        permanentFailedAttempts = att;
        resolveFail();
      },
    });

    await failPromise;
    expect(permanentFailedAttempts).toBe(2);
    expect(queue.getStats().failedPermanently).toBe(1);
  });

  it('activa contingencia PRE-A y encola CAE diferido si ARCA/AFIP está caída durante facturación', async () => {
    const spy = vi
      .spyOn(afipService, 'emitirFacturaAFIP')
      .mockRejectedValue(Object.assign(new Error('504 Gateway Timeout ARCA'), { statusCode: 504 }));

    try {
      const contingency = await resolveAfipCaeOrContingency({
        orderId: 555,
        billingType: 'OFFICIAL' as any,
        deferCae: false,
        finalInvoiceType: 'FACTURA_A' as any,
        cuitLimpio: '30712345678',
        docType: 80,
        officialOrderTotal: 121000,
        isFacturaAOfficial: true,
        net: 100000,
        tax: 21000,
        percepIIBB: 0,
        percepIVA: 0,
      });

      expect(contingency.finalInvoiceNumber).toBe('PRE-A-000555');
      expect(contingency.finalCae).toBeNull();
      expect(contingency.shouldEnqueueDeferredCae).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('comprime + cifra backups con AES-256-GCM, detecta adulteración de 1 bit y rota archivos antiguos', () => {
    const strongKey = 'DonVenancio-BackupKey-2026-UltraSegura!';
    const sampleDump = JSON.stringify({
      meta: { version: '2.0', tables: 13 },
      accountLedger: Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        personaId: 10,
        amount: 15000,
        balanceAfter: (i + 1) * 15000,
      })),
    });

    expect(() => encryptAndCompressBackup(sampleDump, 'clave-corta')).toThrow(/16 caracteres/);

    const encrypted = encryptAndCompressBackup(sampleDump, strongKey);
    expect(encrypted.encryptedBytes).toBeLessThan(encrypted.plainBytes);
    expect(encrypted.sha256Hex).toMatch(/^[a-f0-9]{64}$/);

    // Descifrado legítimo exacto byte a byte
    const restored = decryptAndDecompressBackup(encrypted.encryptedBuffer, strongKey);
    expect(restored.toString('utf8')).toBe(sampleDump);

    // Clave equivocada rechazada por AuthTag GCM
    expect(() =>
      decryptAndDecompressBackup(encrypted.encryptedBuffer, 'OtraClaveDistinta-PeroLarga-9999!'),
    ).toThrow(/AES-256-GCM/);

    // Adulteración de 1 solo bit en el ciphertext rechazada por AuthTag GCM
    const tampered = Buffer.from(encrypted.encryptedBuffer);
    tampered[tampered.length - 1] ^= 0x01;
    expect(() => decryptAndDecompressBackup(tampered, strongKey)).toThrow(/AES-256-GCM/);

    // Rotación automática de backups antiguos (.dvbackup.enc)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-bk-test-'));
    try {
      const names = ['b1.dvbackup.enc', 'b2.dvbackup.enc', 'b3.dvbackup.enc', 'b4.dvbackup.enc'];
      names.forEach((n, idx) => {
        const p = path.join(tmpDir, n);
        fs.writeFileSync(p, encrypted.encryptedBuffer);
        const mtime = new Date(Date.now() - (names.length - idx) * 10_000);
        fs.utimesSync(p, mtime, mtime);
      });

      const pruned = pruneOldEncryptedBackups(tmpDir, 2);
      expect(pruned).toEqual(['b2.dvbackup.enc', 'b1.dvbackup.enc']);
      expect(fs.readdirSync(tmpDir).sort()).toEqual(['b3.dvbackup.enc', 'b4.dvbackup.enc']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
