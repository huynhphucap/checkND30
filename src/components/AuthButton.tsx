import { auth, signIn, signOut } from "@/lib/auth";

export default async function AuthButton() {
  const session = await auth();

  if (!session?.user) {
    return (
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button
          type="submit"
          className="text-sm rounded-full border border-black/15 dark:border-white/15 px-4 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          Đăng nhập với Google
        </button>
      </form>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signOut();
      }}
      className="flex items-center gap-3"
    >
      <span className="text-sm text-black/60 dark:text-white/60">
        {session.user.email}
      </span>
      <button
        type="submit"
        className="text-sm rounded-full border border-black/15 dark:border-white/15 px-4 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        Đăng xuất
      </button>
    </form>
  );
}
