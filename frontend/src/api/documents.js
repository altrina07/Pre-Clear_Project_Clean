import http from './http';

export async function listShipmentDocuments(shipmentId) {
  const resp = await http.get(`/Documents/shipments/${shipmentId}/documents`);
  return resp.data;
}

export async function uploadShipmentDocument(shipmentId, file, docType = 'Other') {
  const form = new FormData();
  form.append('file', file);
  form.append('docType', docType);

  const resp = await http.post(`/Documents/shipments/${shipmentId}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return resp.data;
}

export async function markShipmentDocument(shipmentId, documentName) {
  const resp = await http.post(`/Documents/shipments/${shipmentId}/mark-uploaded`, {
    documentName,
  });
  return resp.data;
}

export async function downloadShipmentDocument(id) {
  const resp = await http.get(`/Documents/${id}/download`, { responseType: 'blob' });

  const disposition = resp.headers['content-disposition'] || resp.headers['Content-Disposition'];
  let fileName = `document-${id}`;
  if (disposition) {
    const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    if (match) {
      fileName = decodeURIComponent(match[1] || match[2]);
    }
  }

  return { blob: resp.data, fileName };
}

export function saveBlobToFile(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
