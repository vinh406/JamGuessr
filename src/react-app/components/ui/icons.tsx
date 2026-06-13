interface Props {
  className?: string;
}

export function Google({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function App({ className = "w-6 h-6" }: Props) {
  return (
    <svg className={className} viewBox="0 0 30 30" aria-label="JamGuessr">
      <defs>
        <linearGradient id="app-icon-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <rect width="30" height="30" rx="15" fill="url(#app-icon-bg)" />
      <g transform="translate(3.75, 3.75) scale(0.75)">
        <path
          fill="white"
          d="M10.434.434c-.052.006-.158.064-.348.19-.266.174-.292.188-.896.416-.342.13-.672.246-.732.258s-.288.032-.508.042-.444.03-.5.042c-.322.072-.794.402-1.04.726-.076.1-.11.128-.14.122a3 3 0 0 0-.594-.042l-.136.016-.226.332-.482.704c-.548.794-.912 1.444-1.372 2.45-.336.734-1.086 2.572-1.25 3.06-.218.648-.406 1.44-.658 2.77-.242 1.282-.27 1.544-.286 2.614a19 19 0 0 0 .266 3.536c.132.782.242 1.22.558 2.206.476 1.492.738 2.104 1.286 2.994 1.994 3.244 5.34 5.624 8.948 6.368 1.01.208 1.72.272 2.83.256a11.4 11.4 0 0 0 2.954-.388c3.19-.808 6.156-2.956 8.11-5.872.392-.588.902-1.52 1.182-2.17.634-1.472 1.05-3.432 1.202-5.684.012-.192.024-.678.024-1.08 0-1.11-.038-1.458-.298-2.8-.378-1.962-.514-2.46-1.022-3.72-.566-1.406-.81-1.968-1.166-2.69-.414-.84-.632-1.196-1.522-2.49l-.258-.378c-.02-.038-.48-.04-.648-.002l-.12.024-.06-.076a3 3 0 0 0-.48-.472c-.352-.264-.642-.356-1.138-.356-.402 0-.48-.02-1.198-.29-.636-.242-.662-.254-.918-.424L19.534.45h-.262c-.252.002-.272.004-.49.08-.57.194-1.356.668-1.81 1.092-.284.266-.504.61-.586.918-.056.212-.044.518.03.8.196.74.546 1.516 1.194 2.64.624 1.084.78 1.36 1.14 2.01a139 139 0 0 1 1.71 3.19c.88 1.718 1.19 2.132 1.806 2.42.892.418 2.154.15 3.174-.674.45-.364.858-.898.988-1.302.028-.084.044-.104.08-.104.044 0 .05.02.108.304.176.858.258 1.56.278 2.376.03 1.352-.14 2.494-.558 3.75-1.216 3.65-3.082 5.79-6.486 7.442a7.8 7.8 0 0 1-1.74.634 13.1 13.1 0 0 1-6.38-.014c-.71-.184-1.054-.314-1.8-.682-1.502-.742-2.598-1.508-3.56-2.492-.802-.82-1.39-1.656-1.94-2.756-.622-1.246-1.142-2.762-1.328-3.874-.1-.602-.112-.776-.112-1.588 0-.65.006-.802.046-1.14.084-.726.228-1.668.286-1.886.016-.06.028-.076.06-.07.028.004.058.05.104.166.28.692.966 1.364 1.804 1.762.846.402 1.68.452 2.342.14.254-.12.392-.22.578-.414.358-.376.586-.756 1.398-2.338.19-.368.456-.872.592-1.12.424-.778 1.67-3.022 2.046-3.69.724-1.286 1.036-1.96 1.226-2.668.068-.252.086-.61.04-.806-.122-.526-.564-1.016-1.364-1.518-.71-.444-1.3-.652-1.714-.604"
        />
      </g>
    </svg>
  );
}

export function ArrowDown({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 16 8" width="16" height="8">
      <path d="M 0 0 L 8 8 L 16 0" />
    </svg>
  );
}

export function Camera({ className = "w-6 h-6" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

export function ChatBubble({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

export function CheckCircle({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export function Check({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function ChevronLeft({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

export function ChevronRight({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function Close({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function AvatarFallback({
  className = "w-full h-full",
  gradientId,
  name,
}: Props & { gradientId: string; name?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 30.5 30.5"
      fill="currentColor"
      aria-label={name ?? "Default avatar"}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <rect width="30.5" height="30.5" rx="15.25" fill={`url(#${gradientId})`} />
      <g transform="translate(4.5, 4.5) scale(0.7)">
        <path
          fill="white"
          d="M27.105 2.305c-.369.143-5.064 2.186-5.165 2.252-.137.089-.161.22-.226 1.168l-.042.518-4.706 4.515c-5.01 4.813-4.801 4.629-5.147 4.402-.232-.149-.346-.447-.328-.852.006-.185.381-.578 1.197-1.251.846-.703.888-.757.894-1.06 0-.518-.453-.763-1.43-.763-1.048-.006-1.9.328-2.645 1.037-.864.822-1.245 1.567-1.585 3.098-.238 1.054-.328 1.275-.655 1.573-.363.328-.721.471-2.031.81-.649.173-1.34.393-1.579.506-.792.381-1.376 1.066-1.674 1.966-.203.625-.232 1.722-.054 2.413.512 2.002 2.127 3.926 4.116 4.915.911.453 1.555.625 2.448.667 1.311.06 2.145-.238 2.973-1.072.578-.584.81-1.007 1.15-2.073.351-1.102.536-1.424 1.138-2.019.435-.429.614-.56 1.18-.84.935-.471 1.459-.84 2.049-1.43.625-.625.9-1.12.935-1.698.054-.786-.435-1.525-1.031-1.579-.441-.036-.506-.006-1.001.471-.578.548-.804.667-1.019.53-.185-.125-.411-.602-.417-.876-.006-.208.179-.411 4.402-4.831a701 701 0 0 0 4.736-4.986c.28-.316.369-.375.625-.435.649-.143.774-.191.959-.375.119-.119.22-.31.286-.542.226-.822.381-1.09.703-1.257.101-.054.53-.197.959-.328 1.013-.304 1.239-.435 1.448-.858.131-.28.155-.381.125-.631-.077-.655-.596-1.132-1.209-1.12-.161 0-.334.018-.381.036m-4.307 4.557c.56.56.661.751.483.929-.155.155-.322.066-.894-.506-.578-.572-.673-.739-.512-.9.179-.179.363-.077.923.477M20.92 8.739c.578.572.673.739.512.9-.179.179-.363.077-.923-.477-.56-.56-.661-.751-.483-.929.155-.155.322-.066.894.506m-1.936 1.817c.679.667.715.721.584.917-.161.244-.304.179-.905-.405-.62-.608-.709-.78-.494-.953a.5.5 0 0 1 .191-.107c.036 0 .316.25.625.548m-1.787 1.912c.56.56.655.751.483.923s-.363.077-.923-.483-.655-.751-.483-.923.363-.077.923.483m-1.966 1.841c.31.304.59.602.625.661.077.143-.089.399-.262.399-.179 0-1.299-1.108-1.299-1.287 0-.125.197-.322.322-.322.03 0 .304.25.614.548m-1.847 1.906c.62.608.709.78.494.953a.5.5 0 0 1-.191.107c-.077 0-1.168-1.06-1.251-1.209-.077-.143.089-.399.262-.399.077 0 .334.208.685.548m-2.984.262c.113.113.203.25.203.304 0 .048-.077.185-.179.298-.208.232-.226.435-.066.697.167.262 1.537 1.579 1.722 1.669.131.065.113.137-.137.554-.173.286-.25.524-.244.733.006.238.083.363.286.476.155.089.31.119.685.119.524 0 .636-.048.878-.375.202-.274.238-.286.29-.101.042.149-.137.518-.476.986-.36.494-.393.578-.381.962.006.244.054.393.179.542.256.304.777.458 1.376.405"
        />
      </g>
    </svg>
  );
}

export function Disc({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
    </svg>
  );
}

export function History({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export function Library({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}

export function Lightning({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

export function List({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 10h16M4 14h16M4 18h16"
      />
    </svg>
  );
}

export function Spinner({ className = "w-8 h-8" }: Props) {
  return (
    <svg className={className} viewBox="0 0 30.5 30.5" fill="currentColor">
      <path d="M14.118.036c-.113.012-.459.054-.763.089-.751.083-1.823.31-2.544.536a15.2 15.2 0 0 0-6.106 3.61c-1.351 1.305-2.31 2.615-3.126 4.277C.578 10.574.101 12.486.018 14.744a14.85 14.85 0 0 0 1.567 7.232c.792 1.602 1.614 2.734 2.907 4.033 1.316 1.311 2.454 2.127 4.057 2.913 1.12.548 1.841.816 2.978 1.102 2.978.751 5.969.608 8.876-.423.888-.316 2.425-1.084 3.217-1.614 3.318-2.204 5.671-5.618 6.523-9.46.417-1.894.465-4.045.119-5.945-.262-1.46-.923-3.408-1.257-3.723-.244-.226-.578-.226-.84.012l-.197.173-.03 4.533-.03 4.527-1.293 1.305c-1.281 1.281-1.299 1.305-1.299 1.549 0 .226.036.292.357.637.387.417.447.637.274.971-.048.089-.965 1.037-2.043 2.103-2.341 2.329-2.246 2.282-2.955 1.626-.31-.292-.375-.322-.614-.322s-.304.03-.578.292c-.346.322-.512.423-.697.423-.22 0-.483-.179-.572-.399-.119-.28-.036-.518.304-.852.477-.471.483-.84.024-1.287-.328-.31-.435-.566-.351-.822s4.015-4.182 4.241-4.236c.268-.065.447.012.822.357.328.298.381.328.631.328h.28l1.06-1.048c.578-.578 1.084-1.12 1.12-1.209.048-.107.065-2.645.054-8.656L26.655.369l-.143-.155c-.286-.304-.846-.238-1.013.119-.042.101-.065.721-.065 1.841 0 .935-.012 1.698-.03 1.698s-.22-.161-.453-.351C22.857 1.757 20.153.566 17.323.143c-.584-.083-2.764-.161-3.205-.107m1.465 3.89a.58.58 0 0 1 .238.739c-.131.328-.274.381-1.203.447-2.395.185-4.396 1.025-6.154 2.573-.661.584-.81.649-1.12.494-.28-.131-.387-.334-.351-.637.03-.268.155-.417.9-1.037 1.984-1.668 4.551-2.639 7.059-2.687.346-.006.488.018.631.107m.321 5.01a6.1 6.1 0 0 1 1.996.56c1.418.667 2.436 1.686 3.098 3.092a6.3 6.3 0 0 1-1.328 7.202c-1.918 1.853-4.706 2.335-7.077 1.215-.721-.346-1.209-.679-1.763-1.215a6.3 6.3 0 0 1-1.328-7.202 6.44 6.44 0 0 1 5.659-3.705c.131 0 .465.024.745.054" />
      <path d="M14.654 14.13a1.7 1.7 0 0 0-.447.399c-.161.232-.179.298-.179.715 0 .405.018.488.161.697.089.125.262.298.387.381.185.125.286.149.673.149s.488-.024.673-.149c.125-.083.298-.256.387-.381.143-.209.161-.292.161-.691s-.018-.483-.161-.691c-.262-.369-.536-.524-.995-.548-.328-.018-.441.006-.661.119" />
    </svg>
  );
}

export function Logout({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

export function MusicNoteFilled({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  );
}

export function MusicNote({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
      />
    </svg>
  );
}

export function Plus({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

export function Send({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}

export function Settings({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

export function Users({ className = "w-5 h-5" }: Props) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

interface VolumeProps extends Props {
  volume: number;
}

export function Volume({ className = "w-5 h-5", volume }: VolumeProps) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      {volume === 0 ? (
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
      ) : volume < 50 ? (
        <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
      ) : (
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      )}
    </svg>
  );
}
