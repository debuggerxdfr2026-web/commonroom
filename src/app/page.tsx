"use client";

import type { FormEvent } from "react";
import {
  Bell, Bookmark, Check, ChevronDown, Compass, Heart, Image as ImageIcon,
  LogIn, LogOut, MessageCircle, MessageSquare, Moon, MoreHorizontal, Plus,
  Send, Sun, UserRound, Users, X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Person = {
  id: string; username: string; name: string; bio?: string; avatarUrl?: string | null;
  following?: boolean;
};
type User = Person & { email: string };
type Comment = { id: string; body: string; createdAt: string; user: Person };
type Post = {
  id: string; body: string; mediaUrl: string | null; mediaType: "image" | "video" | null;
  createdAt: string; author: Person; likedByMe: boolean;
  _count: { likes: number; comments: number }; comments: Comment[];
};
type ProfileDetails = Person & {
  createdAt: string;
  _count: { followers: number; following: number; posts: number };
  posts: { id: string; body: string; mediaUrl: string | null; mediaType: string | null; createdAt: string }[];
};
type Notice = {
  id: string; type: string; createdAt: string; readAt: string | null;
  actor: Person | null;
};
type Conversation = {
  id: string;
  members: { user: Person }[];
  messages: { body: string; createdAt: string; senderId: string }[];
};
type Message = { id: string; body: string; createdAt: string; senderId: string; sender: Person };
type Tab = "Home" | "Discover" | "Messages" | "Notifications" | "Profile";
type AuthMode = "login" | "register";

const demoPosts = [
  {
    id: "sample-1", author: { id: "sample-jules", name: "Jules Morgan", username: "julesm" },
    body: "A slow Sunday, a full watering can, and one tiny new leaf. Sometimes that really is the whole plan. 🌱",
    age: "18 min", likes: 18, comments: 4,
  },
  {
    id: "sample-2", author: { id: "sample-imani", name: "Imani Rivers", username: "imanir" },
    body: "What’s a small thing someone did for you recently that stayed with you? I’ll go first: my neighbor left a little bag of lemons at the door.",
    age: "1 hr", likes: 32, comments: 12,
  },
  {
    id: "sample-3", author: { id: "sample-leo", name: "Leo Park", username: "leopark" },
    body: "Took the long way home and found this little pocket of quiet between the buildings. Making more room for detours lately.",
    age: "3 hr", likes: 11, comments: 2,
  },
];

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data as T;
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ person, size = "md" }: { person: Person; size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`avatar avatar-${size}`} aria-label={person.name}>
      {initials(person.name)}
    </div>
  );
}

function shortAge(date: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [notifications, setNotifications] = useState<Notice[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("Home");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [toast, setToast] = useState("");
  const selectedConversationId = selectedConversation?.id;
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  const loadWorkspace = useCallback(async () => {
    const [feed, directory, noticeList, chats] = await Promise.all([
      api<{ posts: Post[] }>("/api/feed"),
      api<{ people: Person[] }>("/api/users"),
      api<{ notifications: Notice[] }>("/api/notifications"),
      api<{ conversations: Conversation[] }>("/api/conversations"),
    ]);
    setPosts(feed.posts);
    setPeople(directory.people);
    setNotifications(noticeList.notifications);
    setConversations(chats.conversations);
  }, []);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("commonroom-theme");
    if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
    api<{ user: User | null }>("/api/auth/me")
      .then(async ({ user: currentUser }) => {
        setUser(currentUser);
        if (currentUser) await loadWorkspace();
      })
      .catch((error: Error) => setPageError(error.message))
      .finally(() => setLoading(false));
  }, [loadWorkspace]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("commonroom-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (activeTab !== "Messages" || !selectedConversationId) return;
    const refresh = async () => {
      try {
        const result = await api<{ messages: Message[] }>(
          `/api/conversations/${selectedConversationId}/messages`,
        );
        setSelectedConversation((current) =>
          current?.id === selectedConversationId
            ? { ...current, messages: result.messages as Conversation["messages"] }
            : current,
        );
      } catch (error) {
        setPageError(error instanceof Error ? error.message : "Couldn’t refresh this conversation.");
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 12_000);
    return () => window.clearInterval(interval);
  }, [activeTab, selectedConversationId]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPageError("");
    const values = new FormData(event.currentTarget);
    const payload = authMode === "register"
      ? {
          name: String(values.get("name") ?? ""),
          username: String(values.get("username") ?? ""),
          email: String(values.get("email") ?? ""),
          password: String(values.get("password") ?? ""),
        }
      : {
          email: String(values.get("email") ?? ""),
          password: String(values.get("password") ?? ""),
        };
    try {
      const result = await api<{ user: User }>(`/api/auth/${authMode}`, {
        method: "POST", body: JSON.stringify(payload),
      });
      setUser(result.user);
      await loadWorkspace();
      setAuthMode(null);
      setPageError("");
      setToast(authMode === "register" ? "You’re in. Welcome to the room!" : "Welcome back!");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Couldn’t sign you in.");
    }
  }

  async function signOut() {
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      setUser(null);
      setPosts([]);
      setPeople([]);
      setNotifications([]);
      setConversations([]);
      setActiveTab("Home");
      setToast("You’ve signed out.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Couldn’t sign out.");
    }
  }

  async function publishPost(body: string, file: File | null) {
    let attachment: { url: string; type: "image" | "video" } | undefined;
    if (file) {
      const form = new FormData();
      form.set("file", file);
      attachment = await api<{ url: string; type: "image" | "video" }>("/api/media", {
        method: "POST", body: form,
      });
    }
    const result = await api<{ post: Post }>("/api/posts", {
      method: "POST",
      body: JSON.stringify({
        body,
        ...(attachment ? { mediaUrl: attachment.url, mediaType: attachment.type } : {}),
      }),
    });
    setPosts((current) => [result.post, ...current]);
    setToast("Your post is out in the room.");
  }

  async function toggleLike(post: Post) {
    const result = await api<{ likedByMe: boolean; count: number }>(
      `/api/posts/${post.id}/like`,
      { method: post.likedByMe ? "DELETE" : "PUT" },
    );
    setPosts((current) => current.map((item) => item.id === post.id
      ? { ...item, likedByMe: result.likedByMe, _count: { ...item._count, likes: result.count } }
      : item));
  }

  async function addComment(post: Post, body: string) {
    const result = await api<{ comment: Comment }>(`/api/posts/${post.id}/comments`, {
      method: "POST", body: JSON.stringify({ body }),
    });
    setPosts((current) => current.map((item) => item.id === post.id
      ? { ...item, comments: [...item.comments, result.comment], _count: { ...item._count, comments: item._count.comments + 1 } }
      : item));
  }

  async function toggleFollow(person: Person) {
    const following = Boolean(person.following);
    const result = await api<{ following: boolean }>(`/api/users/${person.id}/follow`, {
      method: following ? "DELETE" : "PUT",
    });
    setPeople((current) => current.map((item) => item.id === person.id
      ? { ...item, following: result.following }
      : item));
    setSelectedProfile((current) => current?.id === person.id
      ? { ...current, following: result.following }
      : current);
    setToast(result.following ? `You’re now following ${person.name}.` : `You unfollowed ${person.name}.`);
  }

  async function viewNotifications() {
    setActiveTab("Notifications");
    if (unreadCount === 0) return;
    try {
      await api("/api/notifications", { method: "PATCH", body: "{}" });
      setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt ?? new Date().toISOString() })));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Couldn’t update notifications.");
    }
  }

  async function startConversation(person: Person) {
    try {
      const result = await api<{ conversation: Conversation }>("/api/conversations", {
        method: "POST", body: JSON.stringify({ userId: person.id }),
      });
      const existing = conversations.find((conversation) => conversation.id === result.conversation.id);
      setSelectedConversation(existing ?? result.conversation);
      if (!existing) setConversations((current) => [result.conversation, ...current]);
      setActiveTab("Messages");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Couldn’t start a conversation.");
    }
  }

  const navItems: { label: Tab; icon: typeof Compass; action?: () => void }[] = [
    { label: "Home", icon: Compass, action: () => setActiveTab("Home") },
    { label: "Discover", icon: Users, action: () => setActiveTab("Discover") },
    { label: "Messages", icon: MessageSquare, action: () => setActiveTab("Messages") },
    { label: "Notifications", icon: Bell, action: () => void viewNotifications() },
    { label: "Profile", icon: UserRound, action: () => { setSelectedProfile(null); setActiveTab("Profile"); } },
  ];

  function openProfile(person: Person) {
    setSelectedProfile(person);
    setActiveTab("Profile");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setActiveTab("Home")} aria-label="Commonroom home">
          <span className="brand-mark">c</span>
          <span>commonroom</span>
        </button>
        <div className="topbar-center">
          <span className="room-status"><span className="status-dot" /> A good place to be</span>
        </div>
        <div className="topbar-actions">
          <button
            className="icon-button theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
          {user ? (
            <button className="user-chip" onClick={() => { setSelectedProfile(null); setActiveTab("Profile"); }} aria-label={`Open ${user.name}'s profile`}>
              <Avatar person={user} size="sm" />
              <span>{user.name.split(" ")[0]}</span>
              <ChevronDown size={14} />
            </button>
          ) : (
            <button className="button button-primary top-signin" onClick={() => setAuthMode("login")}>
              <LogIn size={16} /> Sign in
            </button>
          )}
        </div>
      </header>

      <div className="workspace">
        <aside className="left-rail" aria-label="Main navigation">
          <div className="rail-label">YOUR ROOM</div>
          <nav className="main-nav">
            {navItems.map(({ label, icon: Icon, action }) => (
              <button
                key={label}
                className={`nav-link ${activeTab === label ? "nav-link-active" : ""}`}
                onClick={action}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{label}</span>
                {label === "Notifications" && unreadCount > 0 && <span className="nav-count">{unreadCount}</span>}
              </button>
            ))}
          </nav>
          <div className="rail-divider" />
          <div className="rail-label">A LITTLE NOTE</div>
          <div className="side-note">
            <span className="note-spark">✳</span>
            <p>Good conversations start with being here.</p>
            <button onClick={() => user ? setActiveTab("Home") : setAuthMode("register")}>
              {user ? "See what’s new" : "Find your people"} <span aria-hidden>↗</span>
            </button>
          </div>
          {user && (
            <button className="signout-link" onClick={() => void signOut()}>
              <LogOut size={17} /> Sign out
            </button>
          )}
          <div className="left-footer"><span>MADE FOR THE IN-BETWEEN</span><span>© COMMONROOM 2026</span></div>
        </aside>

        <main className="main-column">
          {!user && (
            <div className="demo-notice">
              <span className="demo-dot" />
              <span><strong>Just looking around?</strong> You’re seeing a preview with sample community posts.</span>
              <button onClick={() => setAuthMode("register")}>Join the room <span aria-hidden>→</span></button>
            </div>
          )}

          {pageError && (
            <div className="page-alert" role="alert">
              <span>{pageError}</span>
              <button aria-label="Dismiss message" onClick={() => setPageError("")}><X size={16} /></button>
            </div>
          )}

          {activeTab === "Home" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>{user ? "Your room" : "A room of your own"}</h1>
                  <p>{user ? "A little of everything from the people you’re glad to know." : "Good things grow when we make room for each other."}</p>
                </div>
                <span className="today-pill"><span /> {new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span>
              </div>
              {user && <Composer user={user} onPublish={publishPost} onError={(message) => setPageError(message)} />}
              {loading ? (
                <div className="loading-feed" aria-label="Loading your room"><span /><span /><span /></div>
              ) : (
                <div className="feed-list">
                  {user && posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onLike={() => void toggleLike(post).catch((error: Error) => setPageError(error.message))}
                      onComment={(body) => addComment(post, body)}
                      onProfile={() => openProfile(post.author)}
                    />
                  ))}
                  {!user && demoPosts.map((post) => (
                    <article className="post-card demo-post" key={post.id}>
                      <div className="post-head">
                        <Avatar person={post.author} />
                        <div className="post-byline"><strong>{post.author.name}</strong><span>@{post.author.username} · {post.age}</span></div>
                        <span className="sample-label">SAMPLE</span>
                      </div>
                      <p className="post-body">{post.body}</p>
                      <div className="post-actions">
                        <button onClick={() => setAuthMode("login")} aria-label="Sign in to like this post"><Heart size={18} /> <span>{post.likes}</span></button>
                        <button onClick={() => setAuthMode("login")} aria-label="Sign in to see comments"><MessageCircle size={18} /> <span>{post.comments}</span></button>
                        <button className="post-more" aria-label="More post options"><MoreHorizontal size={19} /></button>
                      </div>
                    </article>
                  ))}
                  {user && posts.length === 0 && !loading && (
                    <div className="empty-state">
                      <span className="empty-icon">✳</span>
                      <h2>Your room is ready.</h2>
                      <p>Start with a little hello. Your first post is the beginning of the conversation.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === "Discover" && (
            <>
              <div className="page-heading"><div><h1>Find your people</h1><p>Small introductions can turn into something good.</p></div></div>
              <section className="discover-list">
                {people.length ? people.map((person) => (
                  <PersonRow key={person.id} person={person} onFollow={() => void toggleFollow(person).catch((error: Error) => setPageError(error.message))} onMessage={() => void startConversation(person)} onProfile={() => openProfile(person)} />
                )) : <div className="empty-state"><span className="empty-icon">✳</span><h2>There’s room for more.</h2><p>Check back as more people join the conversation.</p></div>}
              </section>
            </>
          )}

          {activeTab === "Messages" && (
            <>
              <div className="page-heading"><div><h1>Your conversations</h1><p>Pick up where you left off, or say hello to someone new.</p></div></div>
              {selectedConversation ? (
                <MessageThread
                  conversation={selectedConversation}
                  currentUser={user}
                  onBack={() => setSelectedConversation(null)}
                  onSend={async (body) => {
                    const result = await api<{ message: Message }>(`/api/conversations/${selectedConversation.id}/messages`, {
                      method: "POST", body: JSON.stringify({ body }),
                    });
                    setSelectedConversation((current) => current
                      ? { ...current, messages: [...current.messages, result.message] }
                      : current);
                    setConversations((current) => current.map((item) => item.id === selectedConversation.id
                      ? { ...item, messages: [result.message] }
                      : item));
                  }}
                />
              ) : (
                <section className="conversation-list">
                  {conversations.map((conversation) => {
                    const person = conversation.members[0]?.user;
                    if (!person) return null;
                    const lastMessage = conversation.messages[0];
                    return (
                      <button key={conversation.id} className="conversation-row" onClick={() => setSelectedConversation(conversation)}>
                        <Avatar person={person} />
                        <span className="conversation-copy"><strong>{person.name}</strong><span>{lastMessage?.body ?? "Say hello and start a conversation"}</span></span>
                        {lastMessage && <time>{shortAge(lastMessage.createdAt)}</time>}
                      </button>
                    );
                  })}
                  {!conversations.length && <div className="empty-state"><span className="empty-icon"><MessageSquare size={25} /></span><h2>A note can start anything.</h2><p>Visit Discover and start a conversation with someone you’d like to know.</p><button className="button button-secondary" onClick={() => setActiveTab("Discover")}>Find someone <span aria-hidden>→</span></button></div>}
                </section>
              )}
            </>
          )}

          {activeTab === "Notifications" && (
            <>
              <div className="page-heading"><div><h1>Little moments</h1><p>Here’s what’s been happening around you.</p></div></div>
              <section className="notification-list">
                {notifications.map((notice) => (
                  <div className={`notification-row ${notice.readAt ? "" : "notification-unread"}`} key={notice.id}>
                    {notice.actor ? <Avatar person={notice.actor} /> : <span className="notification-mark">✳</span>}
                    <p>
                      <strong>{notice.actor?.name ?? "Someone"}</strong>{" "}
                      {notice.type === "follow" ? "started following you." : notice.type === "like" ? "liked one of your posts." : notice.type === "comment" ? "left a note on your post." : "sent you a message."}
                      <time>{shortAge(notice.createdAt)}</time>
                    </p>
                    {!notice.readAt && <span className="unread-dot" aria-label="Unread" />}
                  </div>
                ))}
                {!notifications.length && <div className="empty-state"><span className="empty-icon"><Bell size={24} /></span><h2>All quiet for now.</h2><p>When someone says hello, you’ll find it here.</p></div>}
              </section>
            </>
          )}

          {activeTab === "Profile" && user && (
            <ProfilePanel
              user={user}
              profile={selectedProfile}
              onEdit={async (name, bio) => {
                const result = await api<{ profile: User }>(`/api/users/${user.id}`, {
                  method: "PATCH", body: JSON.stringify({ name, bio }),
                });
                setUser((current) => current ? { ...current, ...result.profile } : current);
                setSelectedProfile(null);
                setToast("Your profile is up to date.");
              }}
              onFollow={(person) => void toggleFollow(person).catch((error: Error) => setPageError(error.message))}
            />
          )}
          {activeTab === "Profile" && !user && (
            <div className="empty-state"><span className="empty-icon"><Users size={25} /></span><h2>There’s a place for you here.</h2><p>Create an account to find your profile and meet the room.</p><button className="button button-primary" onClick={() => setAuthMode("register")}>Join Commonroom <span aria-hidden>→</span></button></div>
          )}
        </main>

        <aside className="right-rail" aria-label="People and room notes">
          <div className="rail-section">
            <div className="rail-heading"><h2>People you may like</h2><button onClick={() => setActiveTab("Discover")}>See all</button></div>
            {user ? (
              <div className="suggested-people">
                {people.slice(0, 4).map((person) => (
                  <div className="suggested-person" key={person.id}>
                    <button className="person-avatar-link" onClick={() => openProfile(person)}><Avatar person={person} size="sm" /></button>
                    <button className="suggested-name" onClick={() => openProfile(person)}><strong>{person.name}</strong><span>@{person.username}</span></button>
                    <button
                      className={`follow-mini ${person.following ? "following" : ""}`}
                      onClick={() => void toggleFollow(person).catch((error: Error) => setPageError(error.message))}
                      aria-label={person.following ? `Unfollow ${person.name}` : `Follow ${person.name}`}
                    >{person.following ? <Check size={15} /> : <Plus size={15} />}</button>
                  </div>
                ))}
                {!people.length && <p className="rail-empty">You’re one of the first to arrive. That’s a nice thing.</p>}
              </div>
            ) : (
              <div className="rail-preview">
                {[demoPosts[0]!, demoPosts[1]!].map((post) => (
                  <div className="preview-person" key={post.id}><Avatar person={post.author} size="sm" /><div><strong>{post.author.name}</strong><span>Member since this morning</span></div></div>
                ))}
                <span className="preview-caption">SAMPLE COMMUNITY MEMBERS</span>
              </div>
            )}
          </div>
          <div className="rail-divider" />
          <div className="rail-section">
            <div className="rail-heading"><h2>Something to talk about</h2><span className="topic-spark">✳</span></div>
            <div className="topic-list">
              <button onClick={() => setActiveTab("Discover")}><span>01</span><div><strong>Little joys</strong><small>Share a moment you want to keep</small></div><span aria-hidden>↗</span></button>
              <button onClick={() => setActiveTab("Discover")}><span>02</span><div><strong>Made by hand</strong><small>Show us what you’re working on</small></div><span aria-hidden>↗</span></button>
              <button onClick={() => setActiveTab("Discover")}><span>03</span><div><strong>Local corners</strong><small>Find something near you</small></div><span aria-hidden>↗</span></button>
            </div>
          </div>
          {user && (
            <>
              <div className="rail-divider" />
              <div className="rail-section recent-section">
                <div className="rail-heading"><h2>Recent conversations</h2><button onClick={() => setActiveTab("Messages")}>All</button></div>
                {conversations.slice(0, 2).map((conversation) => {
                  const person = conversation.members[0]?.user;
                  if (!person) return null;
                  return <button className="recent-conversation" key={conversation.id} onClick={() => { setSelectedConversation(conversation); setActiveTab("Messages"); }}><Avatar person={person} size="sm" /><div><strong>{person.name}</strong><span>{conversation.messages[0]?.body ?? "Say hello"}</span></div></button>;
                })}
                {!conversations.length && <p className="rail-empty">A conversation is only a hello away.</p>}
              </div>
            </>
          )}
          <div className="right-footer">KINDNESS LOOKS GOOD ON YOU <span>✳</span></div>
        </aside>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map(({ label, icon: Icon, action }) => (
          <button key={label} className={activeTab === label ? "mobile-nav-active" : ""} onClick={action}>
            <span className="mobile-nav-icon"><Icon size={20} />{label === "Notifications" && unreadCount > 0 && <i />}</span>
            <span>{label === "Notifications" ? "Alerts" : label === "Discover" ? "People" : label === "Messages" ? "Inbox" : label}</span>
          </button>
        ))}
      </nav>

      {authMode && (
        <AuthDialog
          mode={authMode}
          onMode={setAuthMode}
          onClose={() => { setAuthMode(null); setPageError(""); }}
          onSubmit={authenticate}
          error={pageError}
        />
      )}
      {toast && <div className="toast" role="status"><span>✳</span>{toast}<button aria-label="Dismiss notification" onClick={() => setToast("")}><X size={14} /></button></div>}
    </div>
  );
}

function Composer({ user, onPublish, onError }: { user: User; onPublish: (body: string, file: File | null) => Promise<void>; onError: (message: string) => void }) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!body.trim() && !file) return;
    setSending(true);
    try {
      await onPublish(body.trim(), file);
      setBody("");
      setFile(null);
      const input = form.querySelector<HTMLInputElement>("input[type=file]");
      if (input) input.value = "";
    } catch (error) {
      onError(error instanceof Error ? error.message : "Your post couldn’t be shared. Please try again.");
    } finally {
      setSending(false);
    }
  }
  return (
    <form className="composer" onSubmit={submit}>
      <Avatar person={user} />
      <div className="composer-main">
        <label className="visually-hidden" htmlFor="post-body">Write a post</label>
        <textarea id="post-body" placeholder="What’s on your mind, today?" value={body} onChange={(event) => setBody(event.target.value)} maxLength={1000} rows={2} />
        {file && <div className="attachment-chip"><span>{file.name}</span><button type="button" onClick={() => setFile(null)} aria-label="Remove attachment"><X size={14} /></button></div>}
        <div className="composer-tools">
          <div className="composer-attachments">
            <label className="tool-button" title="Add an image or video">
              <ImageIcon size={17} /><span>Media</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                onChange={(event) => {
                  const chosen = event.target.files?.[0] ?? null;
                  if (chosen && chosen.size > 10 * 1024 * 1024) {
                    onError("Media must be 10 MB or smaller.");
                    event.target.value = "";
                    return;
                  }
                  setFile(chosen);
                }}
              />
            </label>
            <span className="composer-hint">A little note, up to 1,000 characters</span>
          </div>
          <button className="button button-primary post-submit" type="submit" disabled={sending || (!body.trim() && !file)}>
            {sending ? "Sharing…" : "Share"} <Send size={15} />
          </button>
        </div>
      </div>
    </form>
  );
}

function PostCard({ post, onLike, onComment, onProfile }: { post: Post; onLike: () => void; onComment: (body: string) => Promise<void>; onProfile: () => void }) {
  const [showComments, setShowComments] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [sending, setSending] = useState(false);
  const [allComments, setAllComments] = useState<Comment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentsReload, setCommentsReload] = useState(0);
  useEffect(() => {
    if (!showComments) return;
    let active = true;
    setCommentsLoading(true);
    setCommentsError("");
    api<{ comments: Comment[] }>(`/api/posts/${post.id}/comments`)
      .then(({ comments }) => { if (active) setAllComments(comments); })
      .catch((error: Error) => { if (active) setCommentsError(error.message); })
      .finally(() => { if (active) setCommentsLoading(false); });
    return () => { active = false; };
  }, [commentsReload, post.id, showComments]);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentBody.trim()) return;
    setSending(true);
    try {
      await onComment(commentBody.trim());
      setCommentBody("");
      setShowComments(true);
      setCommentsReload((current) => current + 1);
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : "Your comment couldn’t be added.");
    } finally {
      setSending(false);
    }
  }
  return (
    <article className="post-card">
      <div className="post-head">
        <button className="avatar-action" onClick={onProfile}><Avatar person={post.author} /></button>
        <button className="post-byline" onClick={onProfile}><strong>{post.author.name}</strong><span>@{post.author.username} · {shortAge(post.createdAt)}</span></button>
        <button className="post-more" aria-label="More post options"><MoreHorizontal size={20} /></button>
      </div>
      {post.body && <p className="post-body">{post.body}</p>}
      {post.mediaUrl && (
        <div className={`post-media ${post.mediaType === "video" ? "post-video" : ""}`}>
          {post.mediaType === "video"
            ? <video src={post.mediaUrl} controls preload="metadata" aria-label="Post video" />
            : <Image src={post.mediaUrl} alt="Image shared in this post" width={1200} height={900} unoptimized />}
        </div>
      )}
      <div className="post-actions">
        <button className={post.likedByMe ? "action-liked" : ""} onClick={onLike} aria-label={post.likedByMe ? "Unlike this post" : "Like this post"} aria-pressed={post.likedByMe}>
          <Heart size={18} fill={post.likedByMe ? "currentColor" : "none"} /><span>{post._count.likes}</span>
        </button>
        <button onClick={() => setShowComments((shown) => !shown)} aria-expanded={showComments}>
          <MessageCircle size={18} /><span>{post._count.comments}</span>
        </button>
        <button className="post-more" aria-label="More post options"><Bookmark size={17} /></button>
      </div>
      {showComments && (
        <div className="comments-area">
          {commentsLoading && <p className="comments-status">Gathering the conversation…</p>}
          {commentsError && <p className="form-error comments-error" role="alert">{commentsError} <button onClick={() => setCommentsReload((current) => current + 1)}>Try again</button></p>}
          {(allComments ?? post.comments).map((comment) => (
            <div className="comment-item" key={comment.id}>
              <Avatar person={comment.user} size="sm" />
              <p><strong>{comment.user.name}</strong><span>{comment.body}</span></p>
            </div>
          ))}
          {!commentsLoading && !commentsError && allComments?.length === 0 && <p className="comments-status">Be the first to leave a little note.</p>}
          <form className="comment-form" onSubmit={(event) => void submitComment(event)}>
            <label className="visually-hidden" htmlFor={`comment-${post.id}`}>Write a comment</label>
            <input id={`comment-${post.id}`} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Leave a little note…" maxLength={600} />
            <button disabled={!commentBody.trim() || sending} aria-label="Post comment"><Send size={16} /></button>
          </form>
        </div>
      )}
    </article>
  );
}

function PersonRow({ person, onFollow, onMessage, onProfile }: { person: Person; onFollow: () => void; onMessage: () => void; onProfile: () => void }) {
  return (
    <article className="discover-person">
      <button className="avatar-action" onClick={onProfile}><Avatar person={person} size="lg" /></button>
      <div className="discover-person-copy"><button onClick={onProfile}><strong>{person.name}</strong><span>@{person.username}</span></button><p>{person.bio || "A new face in the room. Say hello."}</p></div>
      <div className="discover-person-actions">
        <button className={`button ${person.following ? "button-secondary" : "button-primary"}`} onClick={onFollow}>{person.following ? <><Check size={15} /> Following</> : <><Plus size={15} /> Follow</>}</button>
        <button className="icon-button" onClick={onMessage} aria-label={`Message ${person.name}`}><MessageCircle size={17} /></button>
      </div>
    </article>
  );
}

function MessageThread({ conversation, currentUser, onBack, onSend }: { conversation: Conversation; currentUser: User | null; onBack: () => void; onSend: (body: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const person = conversation.members[0]?.user;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError("");
    try {
      await onSend(body.trim());
      setBody("");
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Your message couldn’t be sent.");
    } finally {
      setSending(false);
    }
  }
  return (
    <section className="message-thread">
      <div className="thread-heading">
        <button className="thread-back" onClick={onBack}>← <span>All messages</span></button>
        {person && <><Avatar person={person} size="sm" /><div><strong>{person.name}</strong><span>@{person.username}</span></div></>}
      </div>
      <div className="thread-messages" aria-live="polite">
        {conversation.messages.map((message, index) => (
          <div key={`${message.createdAt}-${index}`} className={`message-bubble ${message.senderId === currentUser?.id ? "message-mine" : ""}`}>
            <p>{message.body}</p><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
          </div>
        ))}
        {!conversation.messages.length && <div className="thread-empty"><span>✳</span><p>Every good conversation starts somewhere.</p></div>}
      </div>
      <form className="message-compose" onSubmit={(event) => void submit(event)}>
        <label className="visually-hidden" htmlFor="message-body">Write a message</label>
        <input id="message-body" placeholder="Write a little something…" value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} />
        <button className="button button-primary" disabled={sending || !body.trim()} aria-label="Send message"><Send size={17} /><span>Send</span></button>
      </form>
      {error && <p className="form-error message-error" role="alert">{error}</p>}
      <p className="thread-note">Messages refresh automatically. Your conversation is saved to your account.</p>
    </section>
  );
}

function ProfilePanel({ user, profile, onEdit, onFollow }: { user: User; profile: Person | null; onEdit: (name: string, bio: string) => Promise<void>; onFollow: (person: Person) => void }) {
  const shown = profile ?? user;
  const ownProfile = shown.id === user.id || !shown.id;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [details, setDetails] = useState<ProfileDetails | null>(null);
  const [detailsError, setDetailsError] = useState("");
  useEffect(() => {
    let active = true;
    setDetails(null);
    setDetailsError("");
    api<{ profile: ProfileDetails }>(`/api/users/${shown.id}`)
      .then(({ profile: current }) => { if (active) setDetails(current); })
      .catch((exception: Error) => { if (active) setDetailsError(exception.message); });
    return () => { active = false; };
  }, [shown.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      await onEdit(String(data.get("name") ?? ""), String(data.get("bio") ?? ""));
      setEditing(false);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Your changes could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="profile-panel">
      <div className="profile-cover"><span>✳</span><span className="cover-orbit" /></div>
      <div className="profile-content">
        <div className="profile-top">
          <Avatar person={shown} size="lg" />
          <div className="profile-buttons">
            {ownProfile
              ? <button className="button button-secondary" onClick={() => setEditing((value) => !value)}>{editing ? "Cancel" : "Edit profile"}</button>
              : <button className="button button-primary" onClick={() => onFollow(shown)}>{shown.following ? "Following" : "Follow"}</button>}
          </div>
        </div>
        {editing && ownProfile ? (
          <form className="profile-edit-form" onSubmit={(event) => void submit(event)}>
            <label>Your name<input name="name" defaultValue={user.name} maxLength={48} required /></label>
            <label>A few words about you<textarea name="bio" defaultValue={user.bio} maxLength={180} rows={3} /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
          </form>
        ) : (
          <>
            <h1>{shown.name}</h1>
            <span className="profile-handle">@{shown.username}</span>
            <p className="profile-bio">{shown.bio || "Making room for good things."}</p>
            <div className="profile-stats">
              <span><strong>{details?._count.posts ?? "—"}</strong> posts</span>
              <span><strong>{details?._count.followers ?? "—"}</strong> followers</span>
              <span><strong>{details?._count.following ?? "—"}</strong> following</span>
              {details && <span>Here since {new Date(details.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>}
            </div>
            <div className="profile-divider" />
            <h2>Notes from {ownProfile ? "you" : shown.name.split(" ")[0]}</h2>
            {detailsError && <p className="form-error profile-error" role="alert">{detailsError}</p>}
            <div className="profile-posts">
              {details?.posts.map((post) => (
                <article className="profile-post" key={post.id}>
                  <div className="profile-post-content">
                    {post.body && <p>{post.body}</p>}
                    {post.mediaUrl && post.mediaType === "image" && <Image className="profile-post-media" src={post.mediaUrl} alt="Image shared in this post" width={480} height={320} unoptimized />}
                    {post.mediaUrl && post.mediaType === "video" && <video className="profile-post-media" src={post.mediaUrl} controls preload="metadata" aria-label="Video shared in this post" />}
                    {!post.body && !post.mediaUrl && <p>Shared a post.</p>}
                  </div>
                  <time>{shortAge(post.createdAt)}</time>
                </article>
              ))}
              {details && details.posts.length === 0 && <p className="profile-note">{ownProfile ? "Your first post will make this space yours." : "No posts here just yet."}</p>}
              {!details && !detailsError && <p className="profile-note">Gathering the notes from this room…</p>}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function AuthDialog({ mode, onMode, onClose, onSubmit, error }: { mode: AuthMode; onMode: (mode: AuthMode) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; error: string }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const selector = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>(selector)];
    focusable()[0]?.focus();
    function containFocus(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", containFocus);
    return () => {
      document.removeEventListener("keydown", containFocus);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="dialog-close icon-button" onClick={onClose} aria-label="Close sign in"><X size={18} /></button>
        <div className="auth-mark">c</div>
        <span className="auth-kicker">{mode === "register" ? "THERE’S ROOM FOR YOU" : "GOOD TO SEE YOU"}</span>
        <h2 id="auth-title">{mode === "register" ? "Come on in." : "Welcome back."}</h2>
        <p>{mode === "register" ? "A good place to share the little things." : "Your room’s right where you left it."}</p>
        <form className="auth-form" onSubmit={onSubmit}>
          {mode === "register" && (
            <>
              <label>Your name<input name="name" autoComplete="name" required minLength={1} maxLength={48} /></label>
              <label>Username<div className="username-input"><span>@</span><input name="username" autoComplete="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" /></div></label>
            </>
          )}
          <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
          <label>Password<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 10 : 1} maxLength={72} /></label>
          {mode === "register" && <span className="password-hint">Use at least 10 characters.</span>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" type="submit">{mode === "register" ? "Create your account" : "Sign in"} <span aria-hidden>→</span></button>
        </form>
        <p className="auth-switch">
          {mode === "register" ? "Already have a place here?" : "New around here?"}{" "}
          <button onClick={() => onMode(mode === "register" ? "login" : "register")}>
            {mode === "register" ? "Sign in" : "Join Commonroom"}
          </button>
        </p>
        <p className="auth-privacy">A secure account, saved on this device with a private session.</p>
      </section>
    </div>
  );
}
