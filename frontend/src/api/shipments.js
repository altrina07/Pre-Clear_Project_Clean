import http from './http';

// Fetch all shipments (admin endpoint - uses my-shipments with admin role)
export async function getAllShipments() {
  const resp = await http.get('/shipments/my-shipments');
  return resp.data;
}

// Fetch shipments for the authenticated user (JWT-derived)
export async function getMyShipments() {
  const resp = await http.get('/shipments/user');
  return resp.data;
}

// Fetch a specific shipment by ID (authorization enforced server-side)
export async function getShipmentById(id) {
  const resp = await http.get(`/shipments/user/${id}`);
  return resp.data;
}

// Poll shipment status for real-time updates (GET /api/shipments/{id}/status)
export async function pollShipmentStatus(id) {
  const resp = await http.get(`/shipments/${id}/status`);
  return resp.data;
}

// Create a new shipment
export async function createShipment(payload) {
  const resp = await http.post('/shipments', payload);
  return resp.data;
}

// Update shipment fields
export async function updateShipment(id, payload) {
  const resp = await http.patch(`/shipments/${id}`, payload);
  return resp.data;
}

// Update shipment status
export async function updateShipmentStatus(id, status) {
  const resp = await http.put(`/shipments/${id}/status`, { status });
  return resp.data;
}

// Run AI compliance check for a shipment
export async function runAiCheck(id, body = { checkType: 'full' }) {
  const resp = await http.post(`/shipments/${id}/ai-check`, { shipmentId: id, ...body });
  return resp.data;
}

// Submit AI for a shipment (immediate pending + background processing)
export async function submitAi(id) {
  const resp = await http.post(`/shipments/${id}/submit-ai`);
  return resp.data;
}

// Generate PreclearToken after both approvals are complete
export async function generateToken(id) {
  const resp = await http.post(`/shipments/${id}/generate-token`);
  return resp.data;
}

// Broker approval action (approved | rejected | documents-requested)
export async function brokerApprove(id, decision, notes) {
  const body = { Decision: decision, Notes: notes };
  const resp = await http.post(`/shipments/${id}/broker-approve`, body);
  return resp.data;
}

// Upload document for a shipment (S3-backed)
export async function uploadDocument(id, file, docType) {
  const form = new FormData();
  form.append('file', file);
  form.append('docType', docType);

  const resp = await http.post(`/documents/shipments/${id}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return resp.data;
}

// Assign shipment to broker based on origin country and HS code
export async function assignBroker(shipmentId) {
  const resp = await http.post(`/shipments/${shipmentId}/assign-broker`);
  return resp.data;
}

// Delete a shipment
export async function deleteShipment(shipmentId) {
  const resp = await http.delete(`/shipments/delete/${shipmentId}`);
  return resp.data;
}
