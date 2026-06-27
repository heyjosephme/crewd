import {
  addDoc,
  collection,
  type DocumentData,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getDb, getStorageInstance, ROOMS } from "./firebase";

// A team-building room. Membership is intentionally NOT modeled (see "fake leave"):
// joining/leaving is a pure front-end concept (which room you're viewing).
export type Room = {
  id: string;
  name: string;
  creatorId: string;
  createdAt: number;
  meetupNote: string | null; // the hero: "5F window table, red hoodie"
  meetupPhotoURL: string | null; // Firebase Storage URL (or a seeded placeholder)
};

export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  createdAt: number;
};

const MESSAGES = "messages";

export function toRoom(id: string, d: DocumentData): Room {
  return {
    id,
    name: typeof d.name === "string" ? d.name : "Untitled room",
    creatorId: typeof d.creatorId === "string" ? d.creatorId : "",
    createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
    meetupNote: typeof d.meetupNote === "string" ? d.meetupNote : null,
    meetupPhotoURL:
      typeof d.meetupPhotoURL === "string" ? d.meetupPhotoURL : null,
  };
}

export function toMessage(id: string, d: DocumentData): Message {
  return {
    id,
    senderId: typeof d.senderId === "string" ? d.senderId : "",
    senderName: typeof d.senderName === "string" ? d.senderName : "Someone",
    senderAvatar: typeof d.senderAvatar === "string" ? d.senderAvatar : undefined,
    text: typeof d.text === "string" ? d.text : "",
    createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
  };
}

export async function createRoom(input: {
  name: string;
  creatorId: string;
}): Promise<string> {
  const created = await addDoc(collection(getDb(), ROOMS), {
    name: input.name,
    creatorId: input.creatorId,
    createdAt: Date.now(),
    meetupNote: null,
    meetupPhotoURL: null,
  });
  return created.id;
}

export function listenRooms(cb: (rooms: Room[]) => void): () => void {
  const q = query(collection(getDb(), ROOMS), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toRoom(d.id, d.data()))),
    (err) => console.error("[rooms] listen error:", err),
  );
}

export function listenRoom(id: string, cb: (room: Room | null) => void): () => void {
  return onSnapshot(
    doc(getDb(), ROOMS, id),
    (snap) => cb(snap.exists() ? toRoom(snap.id, snap.data()) : null),
    (err) => console.error("[room] listen error:", err),
  );
}

export function listenMessages(
  roomId: string,
  cb: (msgs: Message[]) => void,
): () => void {
  const q = query(
    collection(getDb(), ROOMS, roomId, MESSAGES),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toMessage(d.id, d.data()))),
    (err) => console.error("[messages] listen error:", err),
  );
}

export async function sendMessage(
  roomId: string,
  msg: { senderId: string; senderName: string; senderAvatar?: string; text: string },
): Promise<void> {
  await addDoc(collection(getDb(), ROOMS, roomId, MESSAGES), {
    senderId: msg.senderId,
    senderName: msg.senderName,
    senderAvatar: msg.senderAvatar ?? null,
    text: msg.text,
    createdAt: Date.now(),
  });
}

export async function setMeetupNote(
  roomId: string,
  note: string,
  photoURL: string | null,
): Promise<void> {
  await updateDoc(doc(getDb(), ROOMS, roomId), {
    meetupNote: note,
    meetupPhotoURL: photoURL,
  });
}

// Upload ONE meetup photo to Firebase Storage; returns its download URL.
export async function uploadMeetupPhoto(
  roomId: string,
  file: File,
): Promise<string> {
  const safeName = file.name.replace(/[^\w.-]/g, "_");
  const r = ref(getStorageInstance(), `rooms/${roomId}/meetup-${Date.now()}-${safeName}`);
  await uploadBytes(r, file);
  return getDownloadURL(r);
}
