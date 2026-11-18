import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { computeArDatePreset, formatArDisplayDate } from '../reportDateHelpers';

export type PeriodType = 'week' | 'month' | 'prev_week' | 'prev_month' | 'custom';

export const computePeriodDates = (type: PeriodType): { startDate: string; endDate: string } | null => {
  if (type === 'month') return computeArDatePreset('this_month');
  if (type === 'prev_month') return computeArDatePreset('last_month');
  if (type === 'week') return computeArDatePreset('this_week');
  if (type === 'prev_week') return computeArDatePreset('prev_week');
  return null;
};

export const downloadElementAsA4Pdf = async (element: HTMLElement, filename: string): Promise<void> => {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdfWidth = 210;
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: [pdfWidth, pdfHeight],
  });
  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(filename);
};

export const formatArsCurrency = (val: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(val || 0);
};

export const formatEsDate = (dateStr: string): string => formatArDisplayDate(dateStr);
