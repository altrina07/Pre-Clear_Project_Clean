import { useEffect, useState } from 'react';
import { MessageCircle, Send, X, User } from 'lucide-react';
import { useMessages, useShipments } from '../hooks/useShipments';
import { shipmentsStore } from '../store/shipmentsStore';

export function ChatPanel({ shipmentId, userRole, userName, isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { loadShipmentMessages, sendShipmentMessage } = useShipments();

  useEffect(() => {
    const fetchMessages = async () => {
      if (!isOpen || !shipmentId) return;
      setIsLoading(true);
      setError(null);
      try {
        await loadShipmentMessages(shipmentId);
      } catch (err) {
        setError(err?.message || 'Unable to load messages');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [isOpen, shipmentId]);

  useEffect(() => {
    if (!isOpen || !shipmentId) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listShipmentMessages(shipmentId);
        setMessages(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err?.message || 'Failed to load messages');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isOpen, shipmentId]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    const send = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await sendShipmentMessage(shipmentId, newMessage, userName);
        setNewMessage('');
      } catch (err) {
        setError(err?.message || 'Unable to send message');
      } finally {
        setIsLoading(false);
      }
    };

    send();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col z-50">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-blue-600 rounded-t-xl">
        <div className="flex items-center gap-2 text-white">
          <MessageCircle className="w-5 h-5" />
          <h3>Chat - {shipmentId}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-blue-700 p-1 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && <p className="text-xs text-red-600">{error}</p>}
        {isLoading && messages.length === 0 && (
          <div className="text-center text-slate-500 py-4 text-sm">Loading messages...</div>
        )}
        {messages.length === 0 && (
          <div className="text-center text-slate-500 py-8">
            <MessageCircle className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p>No messages yet</p>
            <p className="text-sm">Start a conversation</p>
          </div>
        )}
        
        {messages.map((message) => {
          const messageId = message.id || message.Id;
          const senderLabel = message.senderName || message.SenderName || `User ${message.senderId || message.SenderId || ''}`;
          const isCurrentUser = message.sender === userRole || message.senderName === userName || message.SenderName === userName;
          const isSystem = message.type === 'system' || message.type === 'document-request';
          
          return (
            <div
              key={messageId}
              className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-lg p-3 ${
                  isSystem
                    ? 'bg-amber-50 border border-amber-200'
                    : isCurrentUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <User className={`w-3 h-3 ${isCurrentUser ? 'text-blue-100' : 'text-slate-500'}`} />
                  <span className={`text-xs ${isCurrentUser ? 'text-blue-100' : 'text-slate-500'}`}>
                    {senderLabel}
                  </span>
                </div>
                <p className="text-sm">{message.message}</p>
                <p className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-100' : 'text-slate-500'}`}>
                  {new Date(message.createdAt || message.CreatedAt || message.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
