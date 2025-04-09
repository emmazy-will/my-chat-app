import "./App.css";
import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
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

  if (loading) {
    return (
      <div className="bg-gradient-to-b from-[#0F044C] via-[#141E61] via-[#00D4FF] to-[#000000] px-3 py-3 w-full h-screen flex-1 text-white flex justify-center items-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-blue-500 border-b-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading your chats...</p>
        </div>
      </div>
    );
  }

  // Filter users based on search query and exclude current user
  const filteredUsers = users.filter(user => 
    user.id !== currentUser?.id && 
    (user.name?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-gradient-to-b from-[#0F044C] via-[#141E61] via-[#00D4FF] to-[#000000] px-3 py-3 w-full h-screen flex-1 text-white">
      <ToastContainer />
      <div className="flex items-center mb-6 py-2">
        <img
          src={currentUser?.profilePic || defaultProfile}
          alt="Profile"
          className="w-12 h-12 rounded-full object-cover mr-3"
          title="Your Profile Image"
          onError={(e) => { e.target.src = defaultProfile; }}
        />
        <div className="flex flex-col">
          <span className="font-semibold text-lg">{currentUser?.name || "Anonymous"}</span>
          <span className="text-sm text-blue-400">
            {totalUnreadCount > 0 ? `${totalUnreadCount} unread message${totalUnreadCount !== 1 ? 's' : ''}` : 'Online'}
          </span>
        </div>
        <button 
          className="ml-auto p-2 text-gray-400 hover:text-blue-500 transition-colors" 
          onClick={() => setIsModalOpen(true)}
          aria-label="Edit profile"
        >
          <FaUserEdit size={25} />
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex justify-center items-center z-50" onClick={closeModal}>
          <div className="bg-[#24013C] p-6 rounded-lg w-80 shadow-lg relative" onClick={e => e.stopPropagation()}>
            <button 
              className="absolute top-2 right-3 text-gray-400 hover:text-white text-xl" 
              onClick={closeModal}
              aria-label="Close modal"
            >
              ×
            </button>
            <h2 className="text-2xl font-bold mb-4">Profile Info</h2>
            
            <div className="flex justify-center mb-4">
              <img
                src={currentUser?.profilePic || defaultProfile}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover"
                onError={(e) => { e.target.src = defaultProfile; }}
              />
            </div>
            
            <div className="mb-3">
              <strong>Name:</strong>{" "}
              {editingField === "name" ? (
                <input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="bg-transparent border-b border-gray-400 px-1 ml-2 text-white outline-none"
                />
              ) : (
                <span className="ml-2">{currentUser?.name || "Anonymous"}</span>
              )}
              <FaPen
                className="inline ml-2 cursor-pointer text-gray-400 hover:text-gray-200"
                onClick={() => setEditingField("name")}
              />
            </div>
            
            <div className="mb-3">
              <strong>Email:</strong>{" "}
              {editingField === "email" ? (
                <input
                  value={editedEmail}
                  onChange={(e) => setEditedEmail(e.target.value)}
                  className="bg-transparent border-b border-gray-400 px-1 ml-2 text-white outline-none"
                  type="email"
                />
              ) : (
                <span className="ml-2">{currentUser?.email || "Not Available"}</span>
              )}
              <FaPen
                className="inline ml-2 cursor-pointer text-gray-400 hover:text-gray-200"
                onClick={() => setEditingField("email")}
              />
            </div>
            
            {editingField && (
              <button 
                className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg mt-3 transition-colors"
                onClick={saveChanges}
              >
                Save
              </button>
            )}
            
            <button
              className="mt-5 w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center mb-5 px-3 py-2 border-2 border-gray-700 rounded-lg focus-within:border-blue-500 transition-colors">
        <FaSearch className="text-gray-400 mr-2" />
        <input
          type="text"
          placeholder="Search users"
          className="bg-transparent w-full outline-none text-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="overflow-y-auto h-[calc(100vh-180px)] pb-5 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <div
              key={user.id}
              onClick={() => openChat(user)}
              className="flex items-center justify-between p-3 rounded-md hover:bg-[#070010]/50 cursor-pointer mb-2 transition-colors"
            >
              <div className="flex items-center">
                <div className="relative">
                  <img
                    src={user.profilePic || defaultProfile}
                    alt={user.name || "User"}
                    className="w-12 h-12 rounded-full object-cover mr-3"
                    onError={(e) => { e.target.src = defaultProfile; }}
                  />
                  {/* Online indicator would go here if we had user status */}
                </div>
                <div>
                  <div className="font-medium">{user.name || "Unknown"}</div>
                  {/* Last message preview would go here */}
                </div>
              </div>
              {unreadCounts[user.id] > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center">
                  {unreadCounts[user.id]}
                </span>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-400">
            {searchQuery ? "No users found matching your search" : "No other users available"}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatList;