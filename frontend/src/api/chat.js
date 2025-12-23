import http from './http';

export async function listShipmentMessages(shipmentId) {
  const resp = await http.get(`/chat/shipments/${shipmentId}/messages`);
  return resp.data || [];
}

export async function sendShipmentMessage(shipmentId, message) {
  const resp = await http.post(`/chat/shipments/${shipmentId}/messages`, { message });
  return resp.data;
}
