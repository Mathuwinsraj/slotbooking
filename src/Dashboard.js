import React, { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  addDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import "./App.css";

function Dashboard({ user }) {
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [justification, setJustification] = useState("");
  const [requestsForMe, setRequestsForMe] = useState([]);
  const [counterRequest, setCounterRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestedSlots, setSuggestedSlots] = useState([]);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "slots"),
      (snapshot) => {
        const slotList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSlots(slotList);
        setLoading(false);
      },
      (err) => {
        setError("Failed to fetch slots: " + err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "justifications"),
      where("currentHolder", "==", user.uid),
      where("status", "==", "pending")
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const reqs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRequestsForMe(reqs);
      },
      (err) => setError("Failed to fetch requests: " + err.message)
    );
    return () => unsubscribe();
  }, [user.uid]);

  const suggestAlternativeSlots = (slotId) => {
    const availableSlots = slots.filter(
      (s) => s.id !== slotId && s.bookedby.length === 0
    );
    setSuggestedSlots(availableSlots.slice(0, 3));
  };

  const handleBook = async (slot) => {
    setLoading(true);
    setError(null);
    try {
      const userBookedSlots = slots.filter((s) => s.bookedby.includes(user.uid));
      const isBookedByMe = slot.bookedby.includes(user.uid);

      if (isBookedByMe) {
        const slotRef = doc(db, "slots", slot.id);
        await updateDoc(slotRef, {
          bookedby: arrayRemove(user.uid),
        });
        setLoading(false);
        return;
      }

      if (userBookedSlots.length >= 3) {
        setError("You can only book up to 3 slots.");
        setLoading(false);
        return;
      }

      if (slot.bookedby.length > 0) {
        setSelectedSlot(slot);
        suggestAlternativeSlots(slot.id);
        setLoading(false);
        return;
      }

      const slotRef = doc(db, "slots", slot.id);
      await updateDoc(slotRef, {
        bookedby: arrayUnion(user.uid),
      });
      setLoading(false);
    } catch (err) {
      setError("Failed to book/unbook slot: " + err.message);
      setLoading(false);
    }
  };

  const submitJustification = async () => {
    if (!justification.trim()) {
      setError("Please enter a justification.");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "justifications"), {
        slotId: selectedSlot.id,
        requestedBy: {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
        },
        currentHolder: selectedSlot.bookedby[0],
        reason: justification,
        status: "pending",
        timestamp: new Date(),
      });
      setJustification("");
      setSelectedSlot(null);
      setSuggestedSlots([]);
      setLoading(false);
    } catch (err) {
      setError("Failed to submit justification: " + err.message);
      setLoading(false);
    }
  };

  const submitCounterJustification = async () => {
    if (!counterRequest || !justification.trim()) {
      setError("Please enter your counter-justification.");
      return;
    }
    setLoading(true);
    try {
      const reqRef = doc(db, "justifications", counterRequest.id);
      await updateDoc(reqRef, {
        counterReason: justification,
        status: "pending",
        counterTimestamp: new Date(),
      });
      setJustification("");
      setCounterRequest(null);
      setLoading(false);
    } catch (err) {
      setError("Failed to submit counter-justification: " + err.message);
      setLoading(false);
    }
  };

  const approveRequest = async (req) => {
    setLoading(true);
    try {
      const slotRef = doc(db, "slots", req.slotId);
      await updateDoc(slotRef, {
        bookedby: [req.requestedBy.uid],
      });
      const reqRef = doc(db, "justifications", req.id);
      await updateDoc(reqRef, {
        status: "approved",
      });
      setLoading(false);
    } catch (err) {
      setError("Failed to approve request: " + err.message);
      setLoading(false);
    }
  };

  const rejectRequest = (req) => {
    setCounterRequest(req);
    setJustification("");
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>Welcome, {user.displayName}!</h2>
        <button onClick={() => signOut(auth)} className="logout-btn">Logout</button>
      </div>

      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">{error}</div>}

      {requestsForMe.length > 0 && (
        <div className="section">
          <h3>Slot Requests for Your Bookings</h3>
          <div className="slot-grid">
            {requestsForMe.map((req) => (
              <div key={req.id} className="request-card">
                <p>
                  <strong>{req.requestedBy.name}</strong> wants your slot (<strong>{slots.find((s) => s.id === req.slotId)?.time}</strong>)
                </p>
                <p><em>Reason:</em> {req.reason}</p>
                <div className="button-group">
                  <button onClick={() => approveRequest(req)} className="approve-btn">✅ Approve</button>
                  <button onClick={() => rejectRequest(req)} className="reject-btn">❌ Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {counterRequest && (
        <div className="modal-overlay">
          <div className="modal">
            <h4>Justify Keeping Your Slot</h4>
            <p>
              <strong>{counterRequest.requestedBy.name}</strong> requested your slot (
              <strong>{slots.find((s) => s.id === counterRequest.slotId)?.time}</strong>). Provide a counter-justification.
            </p>
            <textarea
              placeholder="Enter your counter-justification..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="modal-textarea"
            />
            <div className="button-group">
              <button onClick={submitCounterJustification} className="submit-btn">Submit</button>
              <button onClick={() => setCounterRequest(null)} className="cancel-btn">Cancel</button>
            </div>
            <p>AI justification will be done and slot will be appointed accordingly.</p>
          </div>
        </div>
      )}

      <div className="section">
        <h3>My Booked Slots</h3>
        <div className="slot-grid">
          {slots.filter((slot) => slot.bookedby.includes(user.uid)).length === 0 ? (
            <p className="empty-message">You haven't booked any slots yet.</p>
          ) : (
            slots
              .filter((slot) => slot.bookedby.includes(user.uid))
              .map((slot) => (
                <div key={slot.id} className="slot-card booked">
                  <p className="slot-time">{slot.time}</p>
                  <button onClick={() => handleBook(slot)} className="remove-btn">Remove</button>
                </div>
              ))
          )}
        </div>
      </div>

      <div className="section">
        <h3>Available Slots</h3>
        <div className="slot-grid">
          {slots.filter((slot) => slot.bookedby.length === 0).length === 0 ? (
            <p className="empty-message">No slots available.</p>
          ) : (
            slots
              .filter((slot) => slot.bookedby.length === 0)
              .map((slot) => (
                <div key={slot.id} className="slot-card">
                  <p className="slot-time">{slot.time}</p>
                  <button onClick={() => handleBook(slot)} className="book-btn">Book</button>
                </div>
              ))
          )}
        </div>
      </div>

      <div className="section">
        <h3>Taken Slots</h3>
        <div className="slot-grid">
          {slots.filter((slot) => slot.bookedby.length > 0 && !slot.bookedby.includes(user.uid)).length === 0 ? (
            <p className="empty-message">No slots taken by others.</p>
          ) : (
            slots
              .filter((slot) => slot.bookedby.length > 0 && !slot.bookedby.includes(user.uid))
              .map((slot) => (
                <div key={slot.id} className="slot-card taken">
                  <p className="slot-time">{slot.time}</p>
                  <p className="taken-text">Already booked</p>
                  <button onClick={() => handleBook(slot)} className="request-btn">Request</button>
                </div>
              ))
          )}
        </div>
      </div>

      {selectedSlot && (
        <div className="modal-overlay">
          <div className="modal">
            <h4>Slot Already Taken – Submit Justification</h4>
            <p><strong>{selectedSlot.time}</strong></p>
            <textarea
              placeholder="Enter your reason..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="modal-textarea"
            />
            <div className="button-group">
              <button onClick={submitJustification} className="submit-btn">Submit</button>
              <button onClick={() => setSelectedSlot(null)} className="cancel-btn">Cancel</button>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#555" }}>
              AI justification will be done and slot will be appointed accordingly.
            </p>
            {suggestedSlots.length > 0 && (
              <div className="suggested-slots">
                <h5>Alternative Available Slots:</h5>
                <ul>
                  {suggestedSlots.map((s) => (
                    <li key={s.id} className="suggested-slot-item">
                      <span>{s.time}</span>
                      <button onClick={() => handleBook(s)} className="book-btn">Book This Instead</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
