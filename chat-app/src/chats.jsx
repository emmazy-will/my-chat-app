import React, { useState, useEffect, useRef } from "react";
import { 
  Container, 
  Row, 
  Col, 
  Image, 
  Form, 
  Button, 
  Card, 
  Dropdown,
  InputGroup,
  Badge,
  Spinner,
  Overlay
} from "react-bootstrap";
import EmojiPicker from "emoji-picker-react";
import defaultProfile from "./assets/me.jpg";
import { FaSmile, FaPaperPlane, FaArrowLeft, FaReply, FaEdit, FaTrash } from "react-icons/fa";
import { BiCheck, BiCheckDouble } from "react-icons/bi";
import { auth, db } from "./firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  getDocs
} from "firebase/firestore";

const WholeChats = ({ selectedChat, setSelectedChat }) => {
  const [message, setMessage] = useState("");
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [showDropdown, setShowDropdown] = useState(null);
  const target = useRef(null);

  // Authentication state
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // Fetch chats
  useEffect(() => {
    if (!selectedChat || !currentUser) {
      setChats([]);
      return;
    }

    const chatId =
      currentUser.uid < selectedChat.id
        ? `${currentUser.uid}_${selectedChat.id}`
        : `${selectedChat.id}_${currentUser.uid}`;

    // Mark messages as read when the chat is opened
    const markMessagesAsRead = async () => {
      const unreadQuery = query(
        collection(db, "chats"),
        where("chatId", "==", chatId),
        where("receiverId", "==", currentUser.uid),
        where("read", "==", false)
      );
      
      try {
        const querySnapshot = await getDocs(unreadQuery);
        const batch = [];
        querySnapshot.forEach((doc) => {
          batch.push(updateDoc(doc.ref, { read: true }));
        });
        await Promise.all(batch);
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    };
    
    markMessagesAsRead();

    const q = query(
      collection(db, "chats"),
      where("chatId", "==", chatId),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const chatData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setChats(chatData);
        
        // Mark new messages as read as they arrive if this chat is open
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const msg = change.doc.data();
            if (msg.receiverId === currentUser.uid && !msg.read) {
              updateDoc(change.doc.ref, { read: true })
                .catch(err => console.error("Error marking message as read:", err));
            }
          }
        });
      },
      (error) => {
        console.error("Error fetching chats:", error);
      }
    );

    return () => unsubscribe();
  }, [selectedChat, currentUser]);

  // Scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current && chats.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [chats]);

  // Send message with error handling
  const handleSendMessage = async () => {
    if (!message.trim() || !selectedChat || !currentUser) return;

    const chatId =
      currentUser.uid < selectedChat.id
        ? `${currentUser.uid}_${selectedChat.id}`
        : `${selectedChat.id}_${currentUser.uid}`;

    try {
      await addDoc(collection(db, "chats"), {
        chatId,
        userId: currentUser.uid,
        user: currentUser.displayName || "Anonymous",
        receiverId: selectedChat.id,
        text: message,
        timestamp: serverTimestamp(),
        replyTo: replyToMessage
          ? {
              text: replyToMessage.text,
              user: replyToMessage.user,
              messageId: replyToMessage.id,
            }
          : null,
        read: false,
      });
      setMessage("");
      setReplyToMessage(null);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "chats", id));
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const handleEdit = async (id) => {
    if (newMessage.trim() === "") return;
    try {
      await updateDoc(doc(db, "chats", id), { text: newMessage });
      setEditingMessageId(null);
      setNewMessage("");
    } catch (error) {
      console.error("Error editing message:", error);
    }
  };

  const handleEmojiSelect = (emojiObject) => {
    setMessage((prev) => prev + emojiObject.emoji);
    setShowPicker(false);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center h-100">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Card className="text-center p-4">
        <Card.Body>
          <Card.Text>Please log in to view chats.</Card.Text>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Container fluid className="chat-container p-0 d-flex flex-column h-100">
      {/* Header */}
      <Card className="chat-header rounded-0">
        <Card.Body className="d-flex align-items-center p-3">
          <Button 
            variant="link" 
            className="d-md-none text-white me-2 p-0"
            onClick={() => setSelectedChat(null)}
          >
            <FaArrowLeft size={20} />
          </Button>
          <Image
            src={selectedChat?.photoURL || selectedChat?.profilePic || defaultProfile}
            alt="User Profile"
            roundedCircle
            width={40}
            height={40}
            className="me-3 object-fit-cover"
          />
          <div>
            <h6 className="mb-0 fw-bold text-white">{selectedChat?.name || "Anonymous"}</h6>
            <small className="text-white-50">{selectedChat?.status || "Online"}</small>
          </div>
        </Card.Body>
      </Card>

      {/* Messages Container */}
      <div className="messages-container flex-grow-1 p-3">
        {chats.length === 0 ? (
          <div className="d-flex justify-content-center align-items-center h-100">
            <div className="text-center p-4 bg-white rounded-lg shadow-sm">
              <p className="text-muted mb-1">Start the conversation</p>
              <p className="text-muted small">No messages yet. Say hello!</p>
            </div>
          </div>
        ) : (
          <div className="messages-list">
            {chats.map((chat) => {
              const isSent = chat.userId === currentUser?.uid;
              const formattedTime = chat.timestamp?.seconds
                ? new Date(chat.timestamp.seconds * 1000).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Sending...";

              return (
                <div 
                  key={chat.id} 
                  className={`message-wrapper d-flex mb-3 ${isSent ? 'justify-content-end' : 'justify-content-start'}`}
                >
                  {!isSent && (
                    <Image
                      src={selectedChat?.photoURL || selectedChat?.profilePic || defaultProfile}
                      alt="Profile"
                      roundedCircle
                      width={36}
                      height={36}
                      className="me-2 align-self-end"
                    />
                  )}
                  
                  <div className="position-relative">
                    <Card 
                      className={`message-card ${isSent ? 'sent' : 'received'}`}
                      onMouseEnter={() => setShowDropdown(chat.id)}
                      onMouseLeave={() => setShowDropdown(null)}
                    >
                      <Card.Body className="p-2">
                        {/* Reply Preview */}
                        {chat.replyTo && (
                          <Card className={`mb-2 ${isSent ? 'bg-primary text-white' : 'bg-light'}`}>
                            <Card.Body className="p-2">
                              <small className="fw-bold">{chat.replyTo.user}</small>
                              <p className="mb-0 small">{chat.replyTo.text}</p>
                            </Card.Body>
                          </Card>
                        )}

                        {/* Message Content */}
                        {editingMessageId === chat.id ? (
                          <Form.Control
                            as="textarea"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            className="border-0 shadow-none p-0 mb-1"
                            autoFocus
                          />
                        ) : (
                          <p className="mb-1">{chat.text}</p>
                        )}

                        {/* Message Metadata */}
                        <div className="d-flex justify-content-between align-items-center">
                          <small className={`text-muted ${isSent ? 'text-white-50' : 'text-muted'}`}>
                            {formattedTime}
                          </small>
                          {isSent && (
                            <span className="ms-2">
                              {chat.read ? (
                                <BiCheckDouble className="text-white" />
                              ) : chat.timestamp?.seconds ? (
                                <BiCheckDouble className="text-white-50" />
                              ) : (
                                <BiCheck className="text-white-50" />
                              )}
                            </span>
                          )}
                        </div>
                      </Card.Body>
                    </Card>

                    {/* Message Actions */}
                    {showDropdown === chat.id && (
                      <div 
                        ref={target}
                        className={`message-actions ${isSent ? 'sent-actions' : 'received-actions'}`}
                      >
                        <Button
                          variant="link"
                          size="sm"
                          className="text-muted p-0 me-1"
                          onClick={() => {
                            setReplyToMessage(chat);
                            setShowDropdown(null);
                          }}
                        >
                          <FaReply size={14} />
                        </Button>
                        
                        {isSent && (
                          <>
                            {editingMessageId === chat.id ? (
                              <Button
                                variant="link"
                                size="sm"
                                className="text-success p-0 me-1"
                                onClick={() => handleEdit(chat.id)}
                              >
                                Save
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="text-muted p-0 me-1"
                                  onClick={() => {
                                    setEditingMessageId(chat.id);
                                    setNewMessage(chat.text);
                                    setShowDropdown(null);
                                  }}
                                >
                                  <FaEdit size={14} />
                                </Button>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="text-danger p-0"
                                  onClick={() => {
                                    handleDelete(chat.id);
                                    setShowDropdown(null);
                                  }}
                                >
                                  <FaTrash size={14} />
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Reply Preview */}
      {replyToMessage && (
        <Card className="mx-3 mb-2 bg-light border-primary">
          <Card.Body className="p-2">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <small className="fw-bold">Replying to {replyToMessage.user}:</small>{" "}
                <small>{replyToMessage.text}</small>
              </div>
              <Button
                variant="link"
                className="text-danger p-0 ms-3"
                size="sm"
                onClick={() => setReplyToMessage(null)}
              >
                Cancel
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Input Area */}
      <Card className="mx-3 mb-3 border-0 shadow-sm mt-4">
        <Card.Body className="p-2 ">
          <InputGroup>
            <Button 
              variant="link" 
              className="text-muted"
              onClick={() => setShowPicker(!showPicker)}
            >
              <FaSmile size={20} />
            </Button>
            
            <Form.Control
              as="textarea"
              rows={1}
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
              className="border-0 shadow-none"
              style={{ resize: 'none' }}
            />
            
            <Button 
              variant="link" 
              className="text-primary"
              disabled={!message.trim()}
              onClick={handleSendMessage}
            >
              <FaPaperPlane size={20} />
            </Button>
          </InputGroup>
        </Card.Body>
      </Card>

      {/* Emoji Picker */}
      {showPicker && (
        <div className="emoji-picker">
          <EmojiPicker 
            onEmojiClick={handleEmojiSelect} 
            theme="light" 
            height={350} 
            width="100%"
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}

      {/* Custom CSS */}
      <style >{`
        .chat-container {
          background: linear-gradient(135deg,rgb(101, 64, 187),rgb(94, 150, 219)); /* Blue gradient */
        }

        
        .chat-header {
          background: linear-gradient(135deg, #a238bf, #6a1b9a); /* Purple gradient */
          color: white;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        
        .messages-container {
          overflow-y: auto;
          background: linear-gradient(135deg,rgb(63, 55, 65),rgb(150, 102, 180));
          background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%239C92AC' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E");
        }
        
        .message-card {
          border-radius: 18px;
          border: none;
          box-shadow: 0 1px 1px rgba(0,0,0,0.1);
        }
        
        .message-card.sent {
          background-color:rgb(67, 81, 96);
          color: white;
          border-bottom-right-radius: 4px;
        }
        
        .message-card.received {
          background-color: white;
          color: #333;
          border-bottom-left-radius: 4px;
          width: 100px;
        }
        
        
        
        .sent-actions {
          left: -10px;
          top: 50%;
          transform: translateY(-50%);
        }
        
        .received-actions {
          right: -10px;
          top: 50%;
          transform: translateY(-50%);
        }
        
        .emoji-picker {
          position: absolute;
          bottom: 70px;
          right: 20px;
          z-index: 10;
        }
      `}</style>
    </Container>
  );
};

export default WholeChats;