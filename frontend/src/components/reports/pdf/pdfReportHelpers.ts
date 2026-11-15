import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export type PeriodType = 'week' | 'month' | 'prev_week' | 'prev_month' | 'custom';

export const computePeriodDates = (type: PeriodType): { startDate: string; endDate: string } | null => {
  const now = new Date();
  if (type === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
  }
  if (type === 'prev_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
  }
  if (type === 'week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { startDate: monday.toISOString().split('T')[0], endDate: sunday.toISOString().split('T')[0] };
  }
  if (type === 'prev_week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
    const prevMonday = new Date(now.setDate(diff));
    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevMonday.getDate() + 6);
    return { startDate: prevMonday.toISOString().split('T')[0], endDate: prevSunday.toISOString().split('T')[0] };
  }
  return null;
};

export const downloadElementAsA4Pdf = async (element: HTMLElement, filename: string): Promise<void> => {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff'
  });
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdfWidth = 210;
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: [pdfWidth, pdfHeight]
  });
  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(filename);
};

export const formatArsCurrency = (val: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(val || 0);
};

export const formatEsDate = (dateStr: string): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};
