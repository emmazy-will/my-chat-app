import React, { useState, useEffect } from "react";
import ChatList from "./chatList";
import WholeChats from "./chats";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { ErrorBoundary } from 'react-error-boundary';
import { Container, Row, Col, Modal, Button, Spinner } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import "./App.css"; // We'll create this CSS file

function ErrorFallback({ error }) {
  return (
    <div className="alert alert-danger m-3">
      <h5>Something went wrong:</h5>
      <pre className="mt-2 overflow-auto">{error.message}</pre>
    </div>
  );
}

const Dashboard = () => {
  const [selectedChat, setSelectedChat] = useState(null);
  const [user, setUser] = useState(null);
  const [showModal, setShowModal] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
      
      // Hide welcome modal after 2 seconds
      const timer = setTimeout(() => setShowModal(false), 2000);
      return () => clearTimeout(timer);
    });

    return () => unsubscribe();
  }, [auth]);

  const handleBackToList = () => {
    setSelectedChat(null);
  };

  return (
    <div className="dashboard-container">
      {/* Welcome Modal using Bootstrap */}
      <Modal
        show={showModal}
        centered
        backdrop="static"
        className="welcome-modal"
      >
        <Modal.Body>
          <h4>Welcome to the Wizchat...</h4>
        </Modal.Body>
      </Modal>

      {isLoading ? (
        <Container fluid className="loading-container">
          <Spinner animation="border" variant="light" className="custom-spinner" />
        </Container>
      ) : (
        <Container fluid className="main-container p-0">
          <Row className="g-0 full-height">
            {/* Chat List Column */}
            <Col 
              md={4} 
              lg={3} 
              className={`chat-list-column ${selectedChat ? 'd-none d-md-block' : ''}`}
            >
              <ErrorBoundary FallbackComponent={ErrorFallback}>
                <ChatList setSelectedChat={setSelectedChat} />
              </ErrorBoundary>
            </Col>

            {/* Chat Content Column */}
            <Col md={selectedChat ? 8 : 8} lg={selectedChat ? 9 : 9} className="chat-content-column">
              {user ? (
                selectedChat ? (
                  <div className="selected-chat-container">
                    {/* Mobile back button */}
                    <div className="mobile-back-button d-md-none">
                    
                    </div>
                    <WholeChats selectedChat={selectedChat} setSelectedChat={setSelectedChat} />
                  </div>
                ) : (
                  <div className="no-chat-selected">
                    <div className="message-container d-none d-md-block">
                      <h3>Select a chat to start messaging</h3>
                      <p className="tagline">Powered by Wizchat</p>
                    </div>
                  </div>
                )
              ) : (
                <div className="login-message">
                  <div className="message-container">
                    <h4>Please log in to view your conversations</h4>
                  </div>
                </div>
              )}
            </Col>
          </Row>
        </Container>
      )}
    </div>
  );
};

export default Dashboard;