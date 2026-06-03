import { readFileSync } from "fs";
import path from "path";

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("room flow redirect history behavior", () => {
  it("uses replace redirects when create/join actions enter the lobby flow", () => {
    const source = readProjectFile("src/actions/room.ts");

    expect(source).toContain(
      "redirect(`/room/${room.id}/lobby`, RedirectType.replace);"
    );
    expect(source).toContain(
      "redirect(`/room/${room.id}/join`, RedirectType.replace);"
    );
    expect(source).toContain(
      "if (alreadyJoined) redirect(`/room/${roomId}/lobby`, RedirectType.replace);"
    );
    expect(source).toContain(
      "redirect(`/room/${roomId}/lobby`, RedirectType.replace);"
    );
  });

  it("uses replace redirects in stale room phase server guards", () => {
    const joinPage = readProjectFile("src/app/room/[id]/join/page.tsx");
    const lobbyPage = readProjectFile("src/app/room/[id]/lobby/page.tsx");
    const drawPage = readProjectFile("src/app/room/[id]/draw/page.tsx");
    const groupStagePage = readProjectFile("src/app/room/[id]/group-stage/page.tsx");

    expect(joinPage).toContain(
      "redirect(`/room/${roomId}/lobby`, RedirectType.replace)"
    );
    expect(lobbyPage).toContain(
      "redirect(`/room/${roomId}/draw`, RedirectType.replace)"
    );
    expect(lobbyPage).toContain(
      "redirect(`/room/${roomId}/group-stage`, RedirectType.replace)"
    );
    expect(drawPage).toContain(
      "redirect(`/room/${roomId}/group-stage`, RedirectType.replace)"
    );
    expect(groupStagePage).toContain(
      "redirect(`/room/${roomId}/ladder`, RedirectType.replace)"
    );
  });
});
