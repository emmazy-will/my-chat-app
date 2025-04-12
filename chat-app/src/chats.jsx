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
  Overlay,
  Modal,
  ProgressBar,
  Alert
} from "react-bootstrap";
import EmojiPicker from "emoji-picker-react";
import defaultProfile from "./assets/me.jpg";
import { 
  FaSmile, 
  FaPaperPlane, 
  FaArrowLeft, 
  FaReply, 
  FaEdit, 
  FaTrash,
  FaPhone,
  FaVideo,
  FaEllipsisV,
  FaCopy,
  FaList,
  FaImage,
  FaPalette,
  FaMicrophone,
  FaStop,
  FaPlay,
  FaExclamationCircle,
  FaTimes
} from "react-icons/fa";
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
  getDocs,
  setDoc
} from "firebase/firestore";
import { Cloudinary } from "@cloudinary/url-gen";

// Initialize Cloudinary
const cld = new Cloudinary({
  cloud: {
    cloudName: 'dqvnagonh'
  }
});

const WholeChats = ({ selectedChat, setSelectedChat }) => {
  // States for messaging
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
  const [showImageModal, setShowImageModal] = useState(false);
  const target = useRef(null);
  const [error, setError] = useState(null);
  const [isHoveringMessage, setIsHoveringMessage] = useState(false);
  
  // Video call states
  const [videoCallActive, setVideoCallActive] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [showIncomingCallModal, setShowIncomingCallModal] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [callerName, setCallerName] = useState('');
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // Theme and settings
  const [theme, setTheme] = useState('default');

  const themes = {
    default: {
      primary: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)',
      background: 'linear-gradient(135deg, #121212 30%, #1E1E1E 100%)',
      text: '#FFFFFF',
      accent: '#00DAC6',
      bubbleSent: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)',
      bubbleReceived: 'linear-gradient(135deg, #2C3E50 0%, #4CA1AF 100%)'
    },
    dark: {
      primary: 'linear-gradient(135deg, #BB86FC 0%, #7F39FB 100%)',
      background: 'linear-gradient(135deg,rgb(122, 72, 72) 0%,rgb(174, 34, 153) 100%)',
      text: '#FFFFFF',
      accent: '#03DAC6',
      bubbleSent: 'linear-gradient(135deg, #BB86FC 0%, #7F39FB 100%)',
      bubbleReceived: 'linear-gradient(135deg,rgb(103, 55, 149) 0%,rgb(19, 126, 180) 100%)'
    },
    light: {
      primary: 'linear-gradient(135deg, #1976D2 0%, #0D47A1 100%)',
      background: 'linear-gradient(135deg,rgb(156, 199, 116) 0%,rgb(47, 84, 99) 100%)',
      text: '#212529',
      accent: '#FF4081',
      bubbleSent: 'linear-gradient(135deg, #1976D2 0%, #0D47A1 100%)',
      bubbleReceived: 'linear-gradient(135deg, #FFFFFF 0%, #EEEEEE 100%)'
    },
    blue: {
      primary: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)',
      background: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
      text: '#0D47A1',
      accent: '#82B1FF',
      bubbleSent: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)',
      bubbleReceived: 'linear-gradient(135deg, #FFFFFF 0%, #E3F2FD 100%)'
    },
    sunset: {
      primary: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)',
      background: 'linear-gradient(135deg, #2C3E50 0%, #4CA1AF 100%)',
      text: '#FFFFFF',
      accent: '#F9D423',
      bubbleSent: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)',
      bubbleReceived: 'linear-gradient(135deg, #4CA1AF 0%, #2C3E50 100%)'
    },
    modern: {
      primary: 'linear-gradient(135deg, #6e45e2 0%, #88d3ce 100%)',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      text: '#2d3748',
      accent: '#ff6b6b',
      bubbleSent: 'linear-gradient(135deg, #6e45e2 0%, #88d3ce 100%)',
      bubbleReceived: 'linear-gradient(135deg, #FFFFFF 0%, #f5f7fa 100%)'
    }
  };

  const currentTheme = themes[theme];

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);

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
        setError("Failed to mark messages as read");
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
        
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const msg = change.doc.data();
            if (msg.receiverId === currentUser.uid && !msg.read) {
              updateDoc(change.doc.ref, { read: true })
                .catch(err => {
                  console.error("Error marking message as read:", err);
                  setError("Failed to update message status");
                });
            }
          }
        });
      },
      (error) => {
        console.error("Error fetching chats:", error);
        setError("Failed to load messages");
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

  // Clean up streams and intervals
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      clearInterval(recordingIntervalRef.current);
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [localStream, remoteStream]);

  // VIDEO CALL FUNCTIONS

  const startVideoCall = async () => {
    if (!selectedChat || !currentUser) {
      setError("Cannot start call - no chat selected");
      return;
    }

    try {
      setCallStatus('calling');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      peerConnectionRef.current = peerConnection;

      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      await setDoc(doc(db, "calls", selectedChat.id), {
        type: "offer",
        offer: offer,
        from: currentUser.uid,
        fromName: currentUser.displayName || "Anonymous",
        to: selectedChat.id,
        timestamp: serverTimestamp(),
        status: 'ringing'
      });

      setCallStatus('ringing');
      listenForAnswer(peerConnection, selectedChat.id);

    } catch (error) {
      console.error("Call error:", error);
      setError("Failed to start call: " + error.message);
      endVideoCall();
    }
  };

  const listenForAnswer = (peerConnection, calleeId) => {
    const unsubscribe = onSnapshot(doc(db, "calls", currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.type === "answer" && data.from === calleeId) {
          peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
            .then(() => {
              setCallStatus('in-progress');
              setVideoCallActive(true);
            })
            .catch(err => console.error("Set remote description error:", err));
          
          unsubscribe();
        }
      }
    });
  };

  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsubscribe = onSnapshot(doc(db, "calls", currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        if (data.type === "offer" && data.status === 'ringing') {
          setIncomingCall(data);
          setCallerName(data.fromName);
          setShowIncomingCallModal(true);
        }
        
        if (data.type === "end-call") {
          if (videoCallActive) {
            endVideoCall();
          }
          setShowIncomingCallModal(false);
          deleteDoc(doc(db, "calls", currentUser.uid));
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const handleAcceptCall = async () => {
    if (!incomingCall) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      peerConnectionRef.current = peerConnection;

      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer)
      );

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      await setDoc(doc(db, "calls", incomingCall.from), {
        type: "answer",
        answer: answer,
        from: currentUser.uid,
        to: incomingCall.from,
        timestamp: serverTimestamp(),
        status: 'in-progress'
      });

      peerConnection.ontrack = (event) => {
        const remoteStream = new MediaStream();
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      };

      setVideoCallActive(true);
      setShowIncomingCallModal(false);
      setCallStatus('in-progress');
      await deleteDoc(doc(db, "calls", currentUser.uid));

    } catch (error) {
      console.error("Answer call error:", error);
      setError("Failed to answer call: " + error.message);
      endVideoCall();
    }
  };

  const handleDeclineCall = async () => {
    if (!incomingCall) return;
    
    await setDoc(doc(db, "calls", incomingCall.from), {
      type: "call-declined",
      from: currentUser.uid,
      to: incomingCall.from,
      timestamp: serverTimestamp()
    });

    await deleteDoc(doc(db, "calls", currentUser.uid));
    setShowIncomingCallModal(false);
    setIncomingCall(null);
  };

  const endVideoCall = async () => {
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (remoteStream) remoteStream.getTracks().forEach(track => track.stop());
    if (peerConnectionRef.current) peerConnectionRef.current.close();

    if (selectedChat?.id) await deleteDoc(doc(db, "calls", selectedChat.id));
    if (currentUser?.uid) await deleteDoc(doc(db, "calls", currentUser.uid));

    setVideoCallActive(false);
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('');
    peerConnectionRef.current = null;
  };

  useEffect(() => {
    if (callStatus !== 'ringing') return;

    const timeout = setTimeout(() => {
      if (callStatus === 'ringing') {
        setError("Call timed out");
        endVideoCall();
      }
    }, 30000);

    return () => clearTimeout(timeout);
  }, [callStatus]);

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(audioUrl);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setError(null);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      setError("Microphone access denied. Please allow microphone access to record voice messages.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    clearInterval(recordingIntervalRef.current);
  };

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlayingAudio(false);
    }
  };

  const uploadAudioToCloudinary = async (audioBlob) => {
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      if (!audioBlob || !(audioBlob instanceof Blob)) {
        throw new Error('Invalid audio file');
      }

      const formData = new FormData();
      formData.append('file', audioBlob);
      formData.append('upload_preset', 'voice-message');
      formData.append('resource_type', 'auto');
      formData.append('tags', 'voice_message,chat_audio');
      
      const cloudName = 'dqvnagonh';
      const apiUrl = `https://api.cloudinary.com/v1_1/${cloudName}/upload`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Upload failed with status ${response.status}`
        );
      }
      
      const data = await response.json();
      
      if (!data.secure_url) {
        throw new Error('No URL returned from Cloudinary');
      }
      
      setIsUploading(false);
      return data.secure_url;
      
    } catch (error) {
      console.error("Error uploading audio:", error);
      
      let errorMessage = "Failed to upload audio";
      if (error.name === 'AbortError') {
        errorMessage = "Upload timed out (30s)";
      } else if (error.message.includes('network')) {
        errorMessage = "Network error - please check your connection";
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      
      setError(errorMessage);
      setIsUploading(false);
      return null;
    }
  };

  // Send message with error handling
  const handleSendMessage = async () => {
    if ((!message.trim() && !audioUrl) || !selectedChat || !currentUser) return;

    let cloudinaryAudioUrl = null;
    if (audioBlob) {
      cloudinaryAudioUrl = await uploadAudioToCloudinary(audioBlob);
      if (!cloudinaryAudioUrl) return;
    }

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
        audioUrl: cloudinaryAudioUrl || audioUrl || null,
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
      setAudioUrl("");
      setAudioBlob(null);
      setError(null);
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Failed to send message: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "chats", id));
      if (replyToMessage?.id === id) setReplyToMessage(null);
      if (editingMessageId === id) {
        setEditingMessageId(null);
        setNewMessage("");
      }
      setError(null);
    } catch (error) {
      console.error("Error deleting message:", error);
      setError("Failed to delete message. You may not have permission.");
    }
  };

  const handleEdit = async (id) => {
    if (newMessage.trim() === "") return;
    try {
      await updateDoc(doc(db, "chats", id), { text: newMessage });
      setEditingMessageId(null);
      setNewMessage("");
      setError(null);
    } catch (error) {
      console.error("Error editing message:", error);
      setError("Failed to update message");
    }
  };

  const handleEmojiSelect = (emojiObject) => {
    setMessage((prev) => prev + emojiObject.emoji);
    setShowPicker(false);
  };

  const checkCameraPermissions = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some(device => device.kind === 'videoinput');
      if (!hasVideo) throw new Error("No camera found");
      await navigator.mediaDevices.getUserMedia({ video: true });
      return true;
    } catch (error) {
      console.error("Camera check failed:", error);
      return false;
    }
  };

  const handleVoiceCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Voice call initiated with", selectedChat?.name);
      setError(null);
    } catch (error) {
      console.error("Error starting voice call:", error);
      setError("Microphone access denied. Please allow microphone permissions.");
    }
  };

  // Theme functions
  const handleChangeTheme = () => {
    const themeKeys = Object.keys(themes);
    const currentIndex = themeKeys.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themeKeys.length;
    setTheme(themeKeys[nextIndex]);
  };

  // Dropdown menu functions
  const handleCopyMessage = () => {
    if (chats.length > 0) {
      navigator.clipboard.writeText(chats[chats.length-1].text)
        .then(() => {
          setError(null);
        })
        .catch(err => {
          console.error("Failed to copy message:", err);
          setError("Failed to copy message");
        });
    }
  };

  const handleAddToList = () => {
    console.log("Add to list clicked");
    setError("Add to list feature not implemented yet");
  };

  const handleChangeWallpaper = () => {
    console.log("Change wallpaper clicked");
    setError("Change wallpaper feature not implemented yet");
  };

  const applyThemeStyles = () => {
    return {
      background: themes[theme].background,
      color: themes[theme].text,
    };
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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
    <Container fluid className="chat-container p-0 d-flex flex-column h-100" style={applyThemeStyles()}>
      {/* Incoming Call Modal */}
      {showIncomingCallModal && (
        <div className="incoming-call-modal">
          <div className="modal-content">
            <h5>Incoming Video Call</h5>
            <p>From: {callerName}</p>
            <div className="modal-buttons">
              <Button 
                variant="success" 
                onClick={handleAcceptCall}
                className="me-2"
              >
                <FaPhone /> Answer
              </Button>
              <Button 
                variant="danger" 
                onClick={handleDeclineCall}
              >
                <FaTimes /> Decline
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Video Call Modal */}
      <Modal show={videoCallActive} fullscreen onHide={endVideoCall}>
        <Modal.Header closeButton>
          <Modal.Title>Video Call with {selectedChat?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex flex-column">
          <div className="flex-grow-1 position-relative">
            {/* Remote Video */}
            <div className="h-100 w-100 bg-dark">
              {remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="h-100 w-100"
                />
              ) : (
                <div className="d-flex justify-content-center align-items-center h-100 text-white">
                  <div className="text-center">
                    <Spinner animation="border" variant="light" />
                    <p>Connecting to {selectedChat?.name}...</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Local Video */}
            <div className="position-absolute bottom-0 end-0" style={{ width: '25%', height: '25%' }}>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-100 w-100 bg-dark"
              />
            </div>
          </div>
          
          <div className="d-flex justify-content-center p-3">
            <Button variant="danger" onClick={endVideoCall}>
              End Call
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      {/* Header */}
      <Card className="chat-header rounded-0" style={{ background: themes[theme].primary }}>
        <Card.Body className="d-flex align-items-center justify-content-between p-3">
          <div className="d-flex align-items-center">
            <Button 
              variant="link" 
              className="d-md-none text-white me-2 p-0"
              onClick={() => setSelectedChat(null)}
            >
              <FaArrowLeft size={20} />
            </Button>
            
            <div 
              className="position-relative me-3"
              onClick={() => setShowImageModal(true)}
              style={{ cursor: 'pointer' }}
            >
              <Image
                src={selectedChat?.photoURL || selectedChat?.profilePic || defaultProfile}
                alt="User Profile"
                roundedCircle
                width={40}
                height={40}
                className="object-fit-cover"
              />
            </div>
            
            <div>
              <h6 className="mb-0 fw-bold text-white">{selectedChat?.name || "Anonymous"}</h6>
              <small className="text-white-50">{selectedChat?.status || "Online"}</small>
            </div>
          </div>
          
          <div className="d-flex align-items-center">
            <Button 
              variant="link" 
              className="text-white me-2"
              onClick={handleVoiceCall}
            >
              <FaPhone size={18} />
            </Button>
            
            <Button
              variant="link"
              className="text-white me-2"
              onClick={startVideoCall}
              disabled={videoCallActive || !selectedChat}
            >
              <FaVideo size={18} />
              {callStatus === 'ringing' && <span className="ms-2">Ringing...</span>}
            </Button>
            
            <Dropdown show={showDropdown && !isHoveringMessage} onToggle={setShowDropdown}>
              <Dropdown.Toggle variant="link" className="text-white p-0">
                <FaEllipsisV size={18} />
              </Dropdown.Toggle>
              
              <Dropdown.Menu align="end">
                <Dropdown.Item onClick={handleCopyMessage}>
                  <FaCopy className="me-2" /> Copy Message
                </Dropdown.Item>
                <Dropdown.Item onClick={handleAddToList}>
                  <FaList className="me-2" /> Add to List
                </Dropdown.Item>
                <Dropdown.Item onClick={handleChangeWallpaper}>
                  <FaImage className="me-2" /> Change Wallpaper
                </Dropdown.Item>
                <Dropdown.Item onClick={handleChangeTheme}>
                  <FaPalette className="me-2" /> Change Theme
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </Card.Body>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" className="m-3" onClose={() => setError(null)} dismissible>
          <FaExclamationCircle className="me-2" />
          {error}
        </Alert>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="mx-3 mt-2">
          <div className="d-flex justify-content-between mb-1">
            <small>Uploading audio...</small>
            <small>{uploadProgress}%</small>
          </div>
          <ProgressBar now={uploadProgress} animated />
        </div>
      )}

      {/* Messages Container */}
      <div className="messages-container flex-grow-1 p-3 position-relative overflow-hidden">
        {/* Water Droplets Animation */}
        <div className="water-droplets">
          {Array.from({ length: 30 }).map((_, index) => {
            const left = Math.random() * 100;
            const delay = Math.random() * 5;
            const duration = 2 + Math.random() * 3;
            return (
              <span
                className="droplet"
                key={index}
                style={{
                  left: `${left}%`,
                  animationDelay: `${delay}s`,
                  animationDuration: `${duration}s`,
                }}
              ></span>
            );
          })}
        </div>

        {/* Chat Content */}
        {chats.length === 0 ? (
          <div className="d-flex justify-content-center align-items-center h-100 position-relative" style={{ zIndex: 1 }}>
            <div className="text-center p-4 bg-white rounded-lg shadow-sm">
              <p className="text-muted mb-1">Start the conversation</p>
              <p className="text-muted small">No messages yet. Say hello!</p>
            </div>
          </div>
        ) : (
          <div className="messages-list position-relative" style={{ zIndex: 1 }}>
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
                  onMouseEnter={() => {
                    setIsHoveringMessage(true);
                    setShowDropdown(chat.id);
                  }}
                  onMouseLeave={() => {
                    setIsHoveringMessage(false);
                    setShowDropdown(null);
                  }}
                  onTouchStart={() => {
                    setIsHoveringMessage(true);
                    setShowDropdown(chat.id);
                  }}
                  onTouchEnd={() => {
                    setIsHoveringMessage(false);
                    setShowDropdown(null);
                  }}
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
                    <Card className={`message-card ${isSent ? 'sent' : 'received'}`}>
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
                          <>
                            {chat.audioUrl ? (
                              <div className="d-flex align-items-center audio-message">
                                <Button 
                                  variant="link" 
                                  className="p-0 me-2"
                                  onClick={isPlayingAudio && audioRef.current?.src === chat.audioUrl ? stopAudio : playAudio}
                                >
                                  {isPlayingAudio && audioRef.current?.src === chat.audioUrl ? (
                                    <FaStop className="text-danger" />
                                  ) : (
                                    <FaPlay className="text-primary" />
                                  )}
                                </Button>
                                <ProgressBar 
                                  now={30} 
                                  style={{ width: '100px', height: '8px' }} 
                                  className="flex-grow-1"
                                />
                                <small className="ms-2">{formatTime(30)}</small>
                                <audio 
                                  ref={audioRef}
                                  src={chat.audioUrl}
                                  onEnded={() => setIsPlayingAudio(false)}
                                  hidden
                                />
                              </div>
                            ) : (
                              <p className="mb-1">{chat.text}</p>
                            )}
                          </>
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
        <Card.Body className="p-2">
          {audioUrl && (
            <div className="d-flex align-items-center mb-2 p-2 bg-light rounded">
              <audio src={audioUrl} controls className="me-2" />
              <Button 
                variant="link" 
                className="text-danger p-0 ms-auto"
                onClick={() => {
                  setAudioUrl("");
                  setAudioBlob(null);
                }}
              >
                <FaTrash size={14} />
              </Button>
            </div>
          )}
          
          <InputGroup>
            <Button 
              variant="link" 
              className="text-muted"
              onClick={() => setShowPicker(!showPicker)}
            >
              <FaSmile size={20} />
            </Button>
            
            {isRecording ? (
              <div className="d-flex align-items-center flex-grow-1 px-2">
                <Button 
                  variant="danger" 
                  className="rounded-circle me-2"
                  onClick={stopRecording}
                >
                  <FaStop size={12} />
                </Button>
                <div className="flex-grow-1">
                  <ProgressBar 
                    now={(recordingTime % 30) * 3.33} 
                    animated 
                    variant="danger" 
                  />
                </div>
                <small className="ms-2">{formatTime(recordingTime)}</small>
              </div>
            ) : (
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
            )}
            
            <Button 
              variant="link" 
              className="text-muted me-1"
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? (
                <FaStop size={20} className="text-danger" />
              ) : (
                <FaMicrophone size={20} />
              )}
            </Button>
            
            <Button 
              variant="link" 
              className="text-primary"
              disabled={!message.trim() && !audioUrl}
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
            theme={theme === 'dark' ? 'dark' : 'light'} 
            height={350} 
            width="100%"
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}

      {/* Profile Image Zoom Modal */}
      <Modal 
        show={showImageModal} 
        onHide={() => setShowImageModal(false)}
        centered
        size="lg"
      >
        <Modal.Body className="text-center p-0">
          <Image
            src={selectedChat?.photoURL || selectedChat?.profilePic || defaultProfile}
            alt="User Profile"
            fluid
            style={{ maxHeight: '80vh', width: 'auto' }}
          />
        </Modal.Body>
        <Modal.Footer className="justify-content-center">
          <Button 
            variant="secondary" 
            onClick={() => setShowImageModal(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Custom CSS */}
      <style>{`
        .chat-container {
          transition: background 0.3s ease;
        }

        .chat-header {
          transition: background 0.3s ease;
          color: white;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        .messages-container {
          overflow-y: auto;
          transition: background 0.3s ease;
        }
        
        .message-wrapper {
          position: relative;
        }
        
        .message-card {
          border-radius: 18px;
          border: none;
          box-shadow: 0 1px 1px rgba(0,0,0,0.1);
          transition: background-color 0.3s ease;
          max-width: 70%;
        }
        
        .message-card.sent {
          background: ${themes[theme].bubbleSent};
          color: white;
          border-bottom-right-radius: 4px;
        }
        
        .message-card.received {
          background: ${themes[theme].bubbleReceived};
          color: ${themes[theme].text};
          border-bottom-left-radius: 4px;
        }
        
        .message-actions {
          position: absolute;
          display: flex;
          align-items: center;
          background: ${themes[theme].background};
          border-radius: 20px;
          padding: 4px 8px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          z-index: 10;
        }
        
        .sent-actions {
          right: 100%;
          margin-right: 8px;
        }
        
        .received-actions {
          left: 100%;
          margin-left: 8px;
        }
        
        .emoji-picker {
          position: absolute;
          bottom: 70px;
          right: 20px;
          z-index: 10;
        }

        .audio-message {
          padding: 8px;
          background: rgba(0,0,0,0.05);
          border-radius: 8px;
        }

        .incoming-call-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 2000;
        }

        .incoming-call-modal .modal-content {
          background: white;
          padding: 2rem;
          border-radius: 10px;
          text-align: center;
          max-width: 400px;
          width: 100%;
        }

        .incoming-call-modal h5 {
          color: #333;
          margin-bottom: 1rem;
        }

        .incoming-call-modal p {
          color: #555;
          margin-bottom: 2rem;
        }

        .modal-buttons {
          display: flex;
          justify-content: center;
          gap: 1rem;
        }

        .water-droplets {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
          z-index: 0;
        }

        .droplet {
          position: absolute;
          bottom: 100%;
          width: 50px;
          height: 100px;
          background: rgba(245, 102, 25, 0.1);
          border-radius: 50%;
          animation-name: drop;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @keyframes drop {
          0% {
            transform: translateY(-10px) scale(1);
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) scale(0.5);
            opacity: 0;
          }
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .message-card {
            max-width: 85%;
          }
          
          .message-actions {
            padding: 2px 4px;
          }
        }
      `}</style>
    </Container>
  );
};

export default WholeChats;