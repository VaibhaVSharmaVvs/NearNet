import { useState, useEffect, useRef } from 'react'
import { getMessages, sendMessage, API_BASE } from '../api/client'

export default function ChatBox({ requestId, senderType, onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  const fetchMessages = async () => {
    try {
      const data = await getMessages(requestId)
      setMessages(data)
    } catch (err) {
      console.error("Failed to fetch messages", err)
    }
  }

  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;
    let pingInterval = null;

    const connectWebSocket = () => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = API_BASE.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}//${host}/ws/request/${requestId}`;
      
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        fetchMessages(); // Fetch missed messages on connect
        
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === 'new_message') {
          const msg = payload.data;
          setMessages(prev => {
            // Deduplicate
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      };

      ws.onclose = () => {
        if (pingInterval) clearInterval(pingInterval);
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      };
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pingInterval) clearInterval(pingInterval);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [requestId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Auto-scroll on new messages
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || sending) return
    setSending(true)
    try {
      await sendMessage(requestId, senderType, input.trim())
      setInput('')
      await fetchMessages() // immediate fetch
    } catch (err) {
      alert("Failed to send message")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="chatbox-container fade-in">
      <div className="chatbox-header">
        <h4>💬 Chat (Request #{requestId})</h4>
        {onClose && <button onClick={onClose} className="chatbox-close">✕</button>}
      </div>
      <div className="chatbox-messages">
        {messages.length === 0 ? (
          <div className="chatbox-empty">No messages yet. Say hi!</div>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_type === senderType
            return (
              <div key={msg.id} className={`chat-message ${isMe ? 'chat-me' : 'chat-them'}`}>
                <div className="chat-bubble">{msg.message}</div>
                <div className="chat-meta">
                  {msg.sender_type === 'vendor' ? 'Vendor' : 'Customer'} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <form className="chatbox-input-area" onSubmit={handleSend}>
        <input 
          type="text" 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          placeholder="Type a message..." 
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()}>
            {sending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  )
}
