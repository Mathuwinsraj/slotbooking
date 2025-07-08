import React from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "./firebase";

function Login({ setUser }) {
  const signIn = () => {
    signInWithPopup(auth, provider)
      .then((result) => setUser(result.user))
      .catch((error) => console.error("Login Error:", error));
  };

  return (
    <div className="login-wrapper">
      <div className="login-box">
        <h1 className="brand-title">🧠 SMARTSLOT AI</h1>
        <p className="subtitle">
          Efficient invigilation slot booking
        </p>
        <button className="google-btn" onClick={signIn}>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

export default Login;
