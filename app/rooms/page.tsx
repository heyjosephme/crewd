"use client";

import { Loader2, MapPin, Plus, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ensureMe } from "@/lib/identity";
import { createRoom, listenRooms, type Room } from "@/lib/rooms";

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = listenRooms((r) => {
      setRooms(r);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const me = ensureMe();
      const id = await createRoom({ name: trimmed, creatorId: me.id });
      router.push(`/rooms/${id}`);
    } catch (err) {
      console.error("[rooms] create failed:", err);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <header className="mb-5">
        <h1 className="text-3xl font-bold tracking-tight">Rooms</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grab a table, meet your crew in person.
        </p>
      </header>

      {creating ? (
        <form
          onSubmit={onCreate}
          className="mb-5 space-y-3 rounded-2xl border bg-card p-4 shadow-sm"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Room name — e.g. Gemini Agents squad"
            // biome-ignore lint/a11y/noAutofocus: focusing the only field on open is the intent
            autoFocus
            disabled={busy}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !name.trim()} className="flex-1">
              {busy ? <Loader2 className="animate-spin" /> : "Create room"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreating(false)}
              disabled={busy}
            >
              <X />
            </Button>
          </div>
        </form>
      ) : (
        <Button
          onClick={() => setCreating(true)}
          size="lg"
          className="mb-5 w-full"
        >
          <Plus />
          Create a room
        </Button>
      )}

      {!loaded ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">
          No rooms yet — be the first to start one.
        </div>
      ) : (
        <ul className="space-y-3">
          {rooms.map((room) => (
            <li key={room.id}>
              <RoomCard room={room} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function RoomCard({ room }: { room: Room }) {
  return (
    <Link
      href={`/rooms/${room.id}`}
      className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm transition-colors hover:bg-accent/50"
    >
      {room.meetupPhotoURL ? (
        // biome-ignore lint/performance/noImgElement: Storage URLs, no next/image config needed
        <img
          src={room.meetupPhotoURL}
          alt=""
          className="size-16 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="size-6" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{room.name}</p>
        {room.meetupNote ? (
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">{room.meetupNote}</span>
          </p>
        ) : (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            Tap to join the chat →
          </p>
        )}
      </div>
    </Link>
  );
}
