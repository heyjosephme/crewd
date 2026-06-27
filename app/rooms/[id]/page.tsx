"use client";

import {
  ArrowLeft,
  Camera,
  Loader2,
  MapPin,
  Pencil,
  Send,
} from "lucide-react";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ensureMe, type Me, useMe } from "@/lib/identity";
import { DEFAULT_AVATAR } from "@/lib/profile";
import {
  listenMessages,
  listenRoom,
  type Message,
  type Room,
  sendMessage,
  setMeetupNote,
  uploadMeetupPhoto,
} from "@/lib/rooms";

// "Fake leave": the route param IS the single front-end currentRoomId. Navigating
// to /rooms or another room changes it; nothing is written to Firestore for join/leave.
export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useMe();
  const [room, setRoom] = useState<Room | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = listenRoom(id, (r) => {
      setRoom(r);
      setLoaded(true);
    });
    return () => unsub();
  }, [id]);

  const isCreator = !!me && !!room && me.id === room.creatorId;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-4">
      <header className="mb-3 flex items-center gap-2">
        <Link
          href="/rooms"
          className="-ml-1 flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Back to rooms"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight">
          {room?.name ?? "Room"}
        </h1>
      </header>

      {!loaded ? (
        <Centered>
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </Centered>
      ) : !room ? (
        <Centered>
          <p className="text-sm text-muted-foreground">This room no longer exists.</p>
          <Link href="/rooms" className="mt-2 text-sm font-medium text-primary">
            Back to rooms
          </Link>
        </Centered>
      ) : (
        <>
          <MeetupSection room={room} isCreator={isCreator} />
          <Chat roomId={room.id} me={me} />
        </>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">{children}</div>
  );
}

/* ------------------------------- meetup note ------------------------------- */

function MeetupSection({ room, isCreator }: { room: Room; isCreator: boolean }) {
  const [editing, setEditing] = useState(false);
  const hasNote = !!room.meetupNote || !!room.meetupPhotoURL;

  if (editing || (isCreator && !hasNote)) {
    return <MeetupEditor room={room} onDone={() => setEditing(false)} />;
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      {room.meetupPhotoURL && (
        // biome-ignore lint/performance/noImgElement: Storage URL, no next/image config needed
        <img
          src={room.meetupPhotoURL}
          alt="The meetup spot"
          className="aspect-video w-full object-cover"
        />
      )}
      <div className="p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          <MapPin className="size-3.5" />
          Meetup spot
        </div>
        {room.meetupNote ? (
          <p className="mt-1.5 text-lg font-semibold leading-snug">{room.meetupNote}</p>
        ) : (
          <p className="mt-1.5 text-muted-foreground">
            No meetup spot set yet — hang tight in the chat.
          </p>
        )}
        {isCreator && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setEditing(true)}
          >
            <Pencil />
            Edit meetup spot
          </Button>
        )}
      </div>
    </section>
  );
}

function MeetupEditor({ room, onDone }: { room: Room; onDone: () => void }) {
  const [note, setNote] = useState(room.meetupNote ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(room.meetupPhotoURL);
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!note.trim() && !file && !room.meetupPhotoURL) return;
    setBusy(true);
    setWarn(null);
    try {
      let url = room.meetupPhotoURL;
      if (file) url = await uploadMeetupPhoto(room.id, file);
      await setMeetupNote(room.id, note.trim(), url);
      onDone();
    } catch (err) {
      console.error("[meetup] save failed:", err);
      // Graceful fallback: persist the text note even if the photo upload failed.
      try {
        await setMeetupNote(room.id, note.trim(), room.meetupPhotoURL);
        setWarn("Saved your note, but the photo upload failed (Storage not ready).");
        onDone();
      } catch {
        setWarn("Couldn't save. Try again.");
        setBusy(false);
      }
    }
  }

  return (
    <form
      onSubmit={save}
      className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
        <MapPin className="size-3.5" />
        Set the meetup spot
      </div>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="5F window table, I'm in the red hoodie"
        disabled={busy}
      />
      <label className="block cursor-pointer">
        {preview ? (
          // biome-ignore lint/performance/noImgElement: local/object URL preview
          <img
            src={preview}
            alt="Selected meetup spot"
            className="aspect-video w-full rounded-xl object-cover"
          />
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-background/50 text-muted-foreground">
            <Camera className="size-6" />
            <span className="text-sm">Add a photo of the spot</span>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={onPick}
          disabled={busy}
          className="hidden"
        />
      </label>
      {warn && <p className="text-xs text-muted-foreground">{warn}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="flex-1">
          {busy ? <Loader2 className="animate-spin" /> : "Save spot"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ---------------------------------- chat ----------------------------------- */

function Chat({ roomId, me }: { roomId: string; me: Me | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = listenMessages(roomId, setMessages);
    return () => unsub();
  }, [roomId]);

  // Keep the latest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const sender = ensureMe();
    setText("");
    setSending(true);
    try {
      await sendMessage(roomId, {
        senderId: sender.id,
        senderName: sender.name,
        senderAvatar: sender.avatar,
        text: body,
      });
    } catch (err) {
      console.error("[chat] send failed:", err);
      setText(body); // restore on failure
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-4 flex flex-1 flex-col">
      <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Chat</h2>
      <div
        ref={scrollRef}
        className="max-h-[44vh] min-h-[8rem] flex-1 space-y-2.5 overflow-y-auto rounded-2xl border bg-card/50 p-3"
      >
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages yet — say hi 👋
          </p>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} m={m} mine={!!me && m.senderId === me.id} />
          ))
        )}
      </div>

      <form onSubmit={send} className="mt-2 flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the room…"
          disabled={sending}
          enterKeyHint="send"
        />
        <Button type="submit" size="icon" disabled={sending || !text.trim()}>
          {sending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
    </section>
  );
}

function MessageBubble({ m, mine }: { m: Message; mine: boolean }) {
  if (mine) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground">
          {m.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-base"
        aria-hidden
      >
        {m.senderAvatar || DEFAULT_AVATAR}
      </span>
      <div className="max-w-[80%]">
        <p className="mb-0.5 px-1 text-xs text-muted-foreground">{m.senderName}</p>
        <div className="rounded-2xl rounded-bl-md border bg-card px-3 py-2 text-sm">
          {m.text}
        </div>
      </div>
    </div>
  );
}
