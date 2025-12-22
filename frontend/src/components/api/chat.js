import http from '../../api/http';

export async function getShipmentMessages(shipmentId) {
  const resp = await http.get(`/chat/shipments/${shipmentId}/messages`);
  return resp.data;
}

export async function sendMessage(shipmentId, message) {
  const resp = await http.post(`/chat/shipments/${shipmentId}/messages`, { message });
  return resp.data;
}
