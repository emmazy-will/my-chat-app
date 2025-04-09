import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Image,
  Form,
  Button,
  InputGroup,
  Modal,
  Badge,
  ListGroup,
  Spinner
} from "react-bootstrap";
import defaultProfile from "./assets/me.jpg"; // Default profile image
import { FaSearch, FaUserEdit, FaPen } from "react-icons/fa";
import { db } from "./firebase";
import {
  collection,
  query,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ChatList = ({ setSelectedChat }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editedName, setEditedName] = useState("");
  const [editedEmail, setEditedEmail] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const auth = getAuth();
  const navigate = useNavigate();

  // Check authentication and get current user data
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setCurrentUser({ id: user.uid, ...userData });
            setEditedName(userData.name || "");
            setEditedEmail(userData.email || "");
          } else {
            // Handle case where user auth exists but no Firestore document
            toast.error("User profile not found", { theme: "dark" });
            await signOut(auth);
            navigate("/login");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          toast.error("Error loading profile", { theme: "dark" });
        }
      } else {
        // Not authenticated, redirect to login
        navigate("/login");
      }
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, [auth, navigate]);

  // Get all users
  useEffect(() => {
    if (!currentUser) return;

    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const usersList = snapshot.docs.map((doc) => ({ 
          id: doc.id, 
          ...doc.data(),
          // Ensure critical fields have default values
          name: doc.data().name || "Unknown User",
          email: doc.data().email || "",
          profilePic: doc.data().profilePic || ""
        }));
        setUsers(usersList);
      } catch (error) {
        console.error("Error fetching users:", error);
        toast.error("Error loading users", { theme: "dark" });
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Monitor unread messages
  useEffect(() => {
    if (!currentUser?.id) return;

    // Get last notification timestamp from localStorage to prevent duplicate toasts
    const lastNotificationTime = parseInt(localStorage.getItem('lastNotificationTime') || '0');

    const chatsRef = collection(db, "chats");
    const q = query(
      chatsRef,
      where("receiverId", "==", currentUser.id),
      where("read", "==", false),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newUnreadCounts = {};
      let newTotalCount = 0;
      const currentTime = Date.now();

      snapshot.docs.forEach((doc) => {
        const message = doc.data();
        const senderId = message.userId;
        
        if (senderId !== currentUser.id) {
          newUnreadCounts[senderId] = (newUnreadCounts[senderId] || 0) + 1;
          newTotalCount++;
          
          // Show toast only for new messages (in the last 10 seconds)
          // and avoid duplicate notifications by checking timestamp
          const messageTimestamp = message.timestamp?.toMillis ? 
            message.timestamp.toMillis() : 
            message.timestamp?.seconds * 1000 || 0;
            
          if (messageTimestamp > lastNotificationTime && messageTimestamp > currentTime - 10000) {
            const senderUser = users.find(u => u.id === senderId);
            const senderName = senderUser?.name || "Someone";
            
            toast.info(`📩 New message from ${senderName}: ${message.text}`, {
              position: "top-right",
              autoClose: 3000,
              theme: "dark",
            });
            
            // Update last notification time
            localStorage.setItem('lastNotificationTime', messageTimestamp.toString());
          }
        }
      });

      setUnreadCounts(newUnreadCounts);
      setTotalUnreadCount(newTotalCount);
      
      // Update the browser tab title with unread count
      if (newTotalCount > 0) {
        document.title = `(${newTotalCount}) Chat App`;
      } else {
        document.title = "Chat App";
      }
    });

    return () => unsubscribe();
  }, [currentUser, users]);

  const validateProfileUpdates = () => {
    if (!editedName.trim()) {
      toast.error("Name cannot be empty", { theme: "dark" });
      return false;
    }
    
    if (!editedEmail.trim() || !/^\S+@\S+\.\S+$/.test(editedEmail)) {
      toast.error("Please enter a valid email address", { theme: "dark" });
      return false;
    }
    
    return true;
  };

  const saveChanges = async () => {
    if (!currentUser?.id || !validateProfileUpdates()) return;
    
    try {
      await updateDoc(doc(db, "users", currentUser.id), {
        name: editedName.trim(),
        email: editedEmail.trim(),
        updatedAt: new Date().toISOString()
      });
      
      setCurrentUser((prev) => ({ 
        ...prev, 
        name: editedName.trim(), 
        email: editedEmail.trim() 
      }));
      
      toast.success("Profile updated successfully!", { 
        position: "top-right", 
        theme: "dark" 
      });
      
      setEditingField(null);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(`Error updating profile: ${error.message}`, { 
        position: "top-right", 
        theme: "dark" 
      });
    }
  };

  const openChat = async (user) => {
    if (!user?.id || !currentUser?.id) {
      toast.error("Cannot open chat at this time", { theme: "dark" });
      return;
    }
    
    setSelectedChat(user);
    
    // Update unread counts in UI immediately for better UX
    setUnreadCounts((prev) => {
      const newCounts = { ...prev };
      const countForUser = newCounts[user.id] || 0;
      
      // Subtract this user's unread count from total
      setTotalUnreadCount(prev => {
        const newTotal = Math.max(0, prev - countForUser);
        
        // Update document title
        if (newTotal > 0) {
          document.title = `(${newTotal}) Chat App`;
        } else {
          document.title = "Chat App";
        }
        
        return newTotal;
      });
      
      // Clear this user's unread count
      newCounts[user.id] = 0;
      return newCounts;
    });

    try {
      const chatId = currentUser.id < user.id
        ? `${currentUser.id}_${user.id}`
        : `${user.id}_${currentUser.id}`;
      
      const chatsRef = collection(db, "chats");
      const q = query(
        chatsRef,
        where("chatId", "==", chatId),
        where("receiverId", "==", currentUser.id),
        where("read", "==", false)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) return;
      
      // Update batch of messages to read=true
      const batchUpdates = querySnapshot.docs.map((doc) =>
        updateDoc(doc.ref, { 
          read: true,
          readAt: new Date().toISOString()
        })
      );
      
      await Promise.all(batchUpdates);
    } catch (error) {
      console.error("Error marking messages as read:", error);
      // Don't show error to user since the UI already updated
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully!");
      document.title = "Chat App"; // Reset title on logout
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error(`Logout error: ${error.message}`);
    }
  };

  const closeModal = () => {
    // Reset editing fields when closing modal
    setEditingField(null);
    setEditedName(currentUser?.name || "");
    setEditedEmail(currentUser?.email || "");
    setIsModalOpen(false);
  };

  // Filter users based on search query and exclude current user
  const filteredUsers = users.filter(user => 
    user.id !== currentUser?.id && 
    (user.name?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <Container fluid className="d-flex justify-content-center align-items-center vh-100 "style={{ background: 'linear-gradient(135deg, #007bff, #0056b3)', color: 'white' }}>
        <div className="text-center text-white">
          <Spinner animation="border" variant="light" className="mb-3" />
          <p>Loading your chats...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="vh-100 d-flex flex-column p-3  text-white"style={{ background: 'linear-gradient(135deg,rgb(160, 56, 201), #0056b3)', color: 'white' }}>
      <ToastContainer />
      
      {/* Header with profile info */}
      <Row className="mb-4 align-items-center">
        <Col xs="auto">
          <Image
            src={currentUser?.profilePic || defaultProfile}
            alt="Profile"
            roundedCircle
            width={48}
            height={48}
            className="object-fit-cover"
            onError={(e) => { e.target.src = defaultProfile; }}
          />
        </Col>
        <Col>
          <div className="fw-bold fs-5">{currentUser?.name || "Anonymous"}</div>
          <div className="small text-info">
            {totalUnreadCount > 0 ? `${totalUnreadCount} unread message${totalUnreadCount !== 1 ? 's' : ''}` : 'Online'}
          </div>
        </Col>
        <Col xs="auto">
          <Button 
            variant="link" 
            className="text-light p-1"
            onClick={() => setIsModalOpen(true)}
            aria-label="Edit profile"
          >
            <FaUserEdit size={22} />
          </Button>
        </Col>
      </Row>

      {/* Search bar */}
      <InputGroup className="mb-4">
        <InputGroup.Text className="bg-transparent text-light border-secondary">
          <FaSearch />
        </InputGroup.Text>
        <Form.Control
          placeholder="Search users"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent text-light border-secondary"
        />
      </InputGroup>

      {/* User list */}
      <div className="flex-grow-1 overflow-auto">
        <ListGroup variant="flush" className="h-100">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <ListGroup.Item 
                key={user.id}
                action
                onClick={() => openChat(user)}
                className="d-flex align-items-center justify-content-between bg-transparent text-white border-secondary border-opacity-25 rounded-2 mb-2"
              >
                <div className="d-flex align-items-center">
                  <div className="position-relative">
                    <Image
                      src={user.profilePic || defaultProfile}
                      alt={user.name || "User"}
                      roundedCircle
                      width={48}
                      height={48}
                      className="me-3 object-fit-cover"
                      onError={(e) => { e.target.src = defaultProfile; }}
                    />
                  </div>
                  <div>
                    <div className="fw-medium">{user.name || "Unknown"}</div>
                  </div>
                </div>
                {unreadCounts[user.id] > 0 && (
                  <Badge bg="danger" pill>
                    {unreadCounts[user.id]}
                  </Badge>
                )}
              </ListGroup.Item>
            ))
          ) : (
            <div className="text-center py-4 text-light-emphasis">
              {searchQuery ? "No users found matching your search" : "No other users available"}
            </div>
          )}
        </ListGroup>
      </div>

      {/* Profile Edit Modal */}
      <Modal show={isModalOpen} onHide={closeModal} centered>
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>Profile Info</Modal.Title>
        </Modal.Header>
        
        <Modal.Body className="bg-primary text-white">
          <div className="text-center mb-4">
            <Image
              src={currentUser?.profilePic || defaultProfile}
              alt="Profile"
              roundedCircle
              width={100}
              height={100}
              className="object-fit-cover"
              onError={(e) => { e.target.src = defaultProfile; }}
            />
          </div>
          
          <Form>
            <Form.Group className="mb-3">
              <div className="d-flex align-items-center">
                <Form.Label className="fw-bold me-2 mb-0">Name:</Form.Label>
                {editingField === "name" ? (
                  <Form.Control
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="bg-transparent text-white border-light"
                    size="sm"
                  />
                ) : (
                  <span>{currentUser?.name || "Anonymous"}</span>
                )}
                <Button 
                  variant="link" 
                  className="ms-2 p-0 text-light-emphasis"
                  onClick={() => setEditingField("name")}
                >
                  <FaPen size={14} />
                </Button>
              </div>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <div className="d-flex align-items-center">
                <Form.Label className="fw-bold me-2 mb-0">Email:</Form.Label>
                {editingField === "email" ? (
                  <Form.Control
                    type="email"
                    value={editedEmail}
                    onChange={(e) => setEditedEmail(e.target.value)}
                    className="bg-transparent text-white border-light"
                    size="sm"
                  />
                ) : (
                  <span>{currentUser?.email || "Not Available"}</span>
                )}
                <Button 
                  variant="link" 
                  className="ms-2 p-0 text-light-emphasis"
                  onClick={() => setEditingField("email")}
                >
                  <FaPen size={14} />
                </Button>
              </div>
            </Form.Group>
            
            {editingField && (
              <Button 
                variant="success" 
                size="sm" 
                className="mt-2" 
                onClick={saveChanges}
              >
                Save
              </Button>
            )}
          </Form>
        </Modal.Body>
        
        <Modal.Footer className="bg-primary text-white">
          <Button variant="danger" onClick={handleLogout} className="w-100">
            Logout
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ChatList;