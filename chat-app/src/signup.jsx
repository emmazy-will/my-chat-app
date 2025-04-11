import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, googleProvider, db } from "./firebase.js";
import { FaEye, FaEyeSlash, FaGoogle, FaUser } from "react-icons/fa";
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dqvnagonh/image/upload";
const CLOUDINARY_UPLOAD_PRESET = "profile-pictures";

const SignUp = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [previewPic, setPreviewPic] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Styles object
  const styles = {
    signupContainer: {
      background: 'linear-gradient(135deg, #24013C 0%, #000000 100%)',
      display: 'flex',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '20px 0'
    },
    signupCard: {
      border: 'none',
      borderRadius: '15px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
      overflow: 'hidden',
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
     
    },
    cardTitle: {
      fontWeight: '700',
      color: '#fff',
      fontSize: '2rem'
    },
    profilePicContainer: {
      width: '120px',
      height: '120px',
      marginBottom: '20px',
      position: 'relative',
      marginLeft: 'auto',
      marginRight: 'auto'
    },
    profilePic: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      borderRadius: '50%',
      border: '3px solid rgba(255, 255, 255, 0.2)'
    },
    uploadBtn: {
      position: 'absolute',
      bottom: '0',
      right: '0',
      background: '#570191',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      border: '2px solid #fff',
      transition: 'all 0.3s ease'
    },
    uploadBtnHover: {
      background: '#7a00d0'
    },
    uploadIcon: {
      color: '#fff',
      fontSize: '1rem'
    },
    formControl: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      color: '#fff',
      padding: '12px 15px',
      borderRadius: '8px'
    },
    formControlFocus: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderColor: '#570191',
      color: '#fff',
      boxShadow: '0 0 0 0.25rem rgba(87, 1, 145, 0.25)'
    },
    formLabel: {
      color: '#fff',
      fontWeight: '500'
    },
    btnPrimary: {
      backgroundColor: '#570191',
      border: 'none',
      padding: '12px',
      borderRadius: '8px',
      fontWeight: '600',
      transition: 'all 0.3s ease'
    },
    btnPrimaryHover: {
      backgroundColor: '#7a00d0'
    },
    btnOutlineDanger: {
      color: '#fff',
      borderColor: '#db4437',
      transition: 'all 0.3s ease'
    },
    btnOutlineDangerHover: {
      backgroundColor: '#db4437',
      borderColor: '#db4437'
    },
    divider: {
      position: 'relative',
      color: 'rgba(255, 255, 255, 0.5)',
      display: 'inline-block',
      padding: '0 10px'
    },
    dividerLine: {
      content: '""',
      position: 'absolute',
      top: '50%',
      width: '100px',
      height: '1px',
      background: 'rgba(255, 255, 255, 0.2)'
    },
    textMuted: {
      color: 'rgba(255, 255, 255, 0.6) !important'
    },
    link: {
      color: '#b57edc',
      transition: 'color 0.3s ease',
      textDecoration: 'none',
      cursor: 'pointer'
    },
    linkHover: {
      color: '#d9b3ff'
    },
    passwordToggleBtn: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      color: '#fff'
    }
  };

  const handleNavigate = () => {
    navigate("/login");
  };

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  const handleImageUpload = async (file) => {
    if (!file) {
      toast.error("No file selected.");
      return null;
    }
  
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  
    try {
      const response = await axios.post(
        CLOUDINARY_URL,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const imageUrl = response.data.secure_url;
      setProfilePic(imageUrl); 
      console.log("Cloudinary Upload Success:", imageUrl);
      return imageUrl;
    } catch (error) {
      toast.error("Error uploading image.");
      console.error("Cloudinary Upload Error:", error.response?.data || error);
      return null;
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);

    let imageUrl = profilePic;

    if (!imageUrl && previewPic) {
        imageUrl = await handleImageUpload(previewPic);
        setProfilePic(imageUrl);
    }

    if (!imageUrl) {
        toast.error("Profile picture upload failed!");
        setLoading(false);
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: userName, photoURL: imageUrl });

        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: userName,
            email: user.email,
            profilePic: user.photoURL || "",
        });

        toast.success("Signed up successfully!");
        setTimeout(() => navigate("/dashboard"), 3000);
    } catch (err) {
        toast.error(err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
  
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          profilePic: user.photoURL,
        },
        { merge: true }
      );
  
      toast.success("Signed up successfully!");
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err) {
      console.log(err)
      toast.error(err.message);
    }
  };
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPreviewPic(file);
      setProfilePic(null);
    }
  };

  return (
    <div style={styles.signupContainer}>
      <ToastContainer position="top-right" autoClose={2000} />
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            <div className="card" style={styles.signupCard}>
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-4">
                  <h2 style={styles.cardTitle}>Create Your Account</h2>
                  <p style={styles.textMuted}>Join our community today</p>
                </div>
                
                <form onSubmit={handleSignUp}>
                  <div className="text-center mb-4">
                    <div style={styles.profilePicContainer}>
                      <img
                        src={profilePic || (previewPic && URL.createObjectURL(previewPic)) || "/default-avatar.png"}
                        alt="Profile"
                        style={styles.profilePic}
                      />
                      <label htmlFor="profile-upload" style={styles.uploadBtn}>
                        <FaUser style={styles.uploadIcon} />
                        <input
                          id="profile-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="d-none"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="username" style={styles.formLabel}>Username</label>
                    <input
                      type="text"
                      className="form-control"
                      id="username"
                      placeholder="Enter username"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      required
                      style={styles.formControl}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="email" style={styles.formLabel}>Email address</label>
                    <input
                      type="email"
                      className="form-control"
                      id="email"
                      placeholder="Enter email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      style={styles.formControl}
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="password" style={styles.formLabel}>Password</label>
                    <div className="input-group">
                      <input
                        type={showPassword ? "text" : "password"}
                        className="form-control"
                        id="password"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={styles.formControl}
                      />
                      <button
                        className="btn btn-outline-secondary"
                        type="button"
                        onClick={togglePassword}
                        style={styles.passwordToggleBtn}
                      >
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-100 mb-3"
                    disabled={loading}
                    style={styles.btnPrimary}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = styles.btnPrimaryHover.backgroundColor}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = styles.btnPrimary.backgroundColor}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Signing Up...
                      </>
                    ) : (
                      "Sign Up"
                    )}
                  </button>

                  <div className="text-center mb-3">
                    <span style={styles.divider}>OR</span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline-danger w-100 mb-3"
                    onClick={handleGoogleSignUp}
                    style={styles.btnOutlineDanger}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = styles.btnOutlineDangerHover.backgroundColor;
                      e.currentTarget.style.borderColor = styles.btnOutlineDangerHover.borderColor;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = styles.btnOutlineDanger.borderColor;
                    }}
                  >
                    <FaGoogle className="me-2" />
                    Sign Up with Google
                  </button>

                  <div className="text-center mt-3">
                    <p className="mb-0">
                      Already have an account?{" "}
                      <span 
                        style={styles.link}
                        onClick={handleNavigate}
                        onMouseOver={(e) => e.currentTarget.style.color = styles.linkHover.color}
                        onMouseOut={(e) => e.currentTarget.style.color = styles.link.color}
                      >
                        Login
                      </span>
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;