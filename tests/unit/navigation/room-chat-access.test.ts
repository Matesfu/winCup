import { readFileSync } from "fs";
import path from "path";

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("room chat access", () => {
  it("renders room chat for hosts or joined players", () => {
    const layout = readProjectFile("src/app/room/[id]/layout.tsx");

    expect(layout).toContain(
      "const canChat = room.host_user_id === user.id || Boolean(playerResult.data);"
    );
    expect(layout).toContain(
      "{canChat && <RoomChatLauncher roomId={id} currentUserId={user.id} />}"
    );
  });

  it("revalidates the room layout after a successful join", () => {
    const roomActions = readProjectFile("src/actions/room.ts");

    expect(roomActions).toContain('import { revalidatePath } from "next/cache";');
    expect(roomActions).toContain('revalidatePath(`/room/${roomId}`, "layout");');
    expect(roomActions).toContain(
      "redirect(`/room/${roomId}/lobby`, RedirectType.replace);"
    );
  });

  it("message API allows hosts or players without checking room phase", () => {
    const route = readProjectFile("src/app/api/rooms/[id]/messages/route.ts");

    expect(route).toContain("const isHost = room.host_user_id === userId;");
    expect(route).toContain("if (!isHost && !player)");
    expect(route).not.toContain('status !== "lobby"');
    expect(route).not.toContain('status === "drawn"');
  });
});
