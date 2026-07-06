import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Download, FileText } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

interface ReceiptViewProps {
  receiptId?: string;
}

const ReceiptView: React.FC<ReceiptViewProps> = ({ receiptId }) => {
  const { id } = useParams<{ id: string }>();
  const activeId = receiptId || id;
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/collections/receipt/${activeId}`);
        setReceipt(res.data);
      } catch (err) {
        setError('El comprobante no existe o no pudo ser cargado.');
      } finally {
        setLoading(false);
      }
    };
    
    if (activeId) fetchReceipt();
  }, [activeId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Cargando recibo...</div>;
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm text-center max-w-sm w-full">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800">Recibo no encontrado</h2>
          <p className="text-gray-500 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (val: number | string) => {
    return Number(val).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute:'2-digit' });
  };

  const paymentMethodEs = {
    'CASH': 'Efectivo',
    'BANK_TRANSFER': 'Transferencia Bancaria',
    'CHECK': 'Cheque',
    'OTHER': 'Otro'
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center font-sans">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl overflow-hidden">
        {/* Header (Logo / Empresa) */}
        <div className="bg-gray-900 text-white p-6 text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-[#E30613] font-bold text-2xl">DV</span>
          </div>
          <h1 className="text-xl font-bold">Distribuidora de Alimentos y Bebidas</h1>
          <p className="text-gray-400 text-sm mt-1">Comprobante de Pago Oficial</p>
        </div>

        {/* Amount & Status */}
        <div className="p-6 text-center border-b border-gray-100">
          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-gray-500 uppercase tracking-widest text-xs font-semibold mb-1">Pago Exitoso</p>
          <h2 className="text-4xl font-extrabold text-gray-900">{formatCurrency(receipt.amount)}</h2>
        </div>

        {/* Details */}
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Nro. de Recibo</span>
            <span className="font-semibold text-gray-800">{receipt.receiptNumber || `REC-00${receipt.id}`}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Fecha</span>
            <span className="font-semibold text-gray-800">{formatDate(receipt.createdAt)}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Cliente</span>
            <span className="font-semibold text-gray-800">{receipt.persona?.name}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Medio de Pago</span>
            <span className="font-semibold text-gray-800">{paymentMethodEs[receipt.paymentMethod as keyof typeof paymentMethodEs] || receipt.paymentMethod}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Sucursal</span>
            <span className="font-semibold text-gray-800">{receipt.billingType === 'OFFICIAL' ? 'A (Oficial)' : 'X (Interno)'}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Cobrado por</span>
            <span className="font-semibold text-gray-800">{receipt.user?.username}</span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="bg-gray-50 p-6 flex gap-3">
          <button 
            onClick={() => window.print()}
            className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
          >
            <Download className="w-5 h-5" />
            Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptView;
