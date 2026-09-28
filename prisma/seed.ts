import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const people = [
    { username: "guest_garden", name: "Guest Gardener", bio: "Collecting little moments and big ideas. Usually near a window with good light." },
    { username: "guest_playlist", name: "Guest Playlist", bio: "Weekend gardener, professional playlist sender." },
    { username: "guest_neighbor", name: "Guest Neighbor", bio: "Building community one thoughtful question at a time." },
    { username: "guest_camera", name: "Guest Camera", bio: "Finding new corners of the city." },
    { username: "guest_maker", name: "Guest Maker", bio: "Making things with my hands and learning as I go." },
  ];
  const users = [];
  for (const person of people) {
    users.push(await prisma.user.upsert({
      where: { username: person.username },
      update: { name: person.name, bio: person.bio },
      create: person,
    }));
  }
  const [gardener, playlist, neighbor, camera, maker] = users;
  if (!gardener || !playlist || !neighbor || !camera || !maker) throw new Error("Seed guest profiles could not be created.");

  const samplePosts = [
    { authorId: playlist.id, body: "A slow Sunday, a full watering can, and one tiny new leaf. Sometimes that really is the whole plan. 🌱" },
    { authorId: neighbor.id, body: "What’s a small thing someone did for you recently that stayed with you? I’ll go first: my neighbor left a little bag of lemons at the door." },
    { authorId: camera.id, body: "Took the long way home and found this little pocket of quiet between the buildings. Making more room for detours lately." },
    { authorId: maker.id, body: "First try at making my own ceramics. It leans a little to the left and I love it anyway." },
  ];
  const postCount = await prisma.post.count({ where: { authorId: { in: users.map((user) => user.id) } } });
  if (postCount === 0) {
    const created = [];
    for (const post of samplePosts) created.push(await prisma.post.create({ data: post }));
    await prisma.like.createMany({
      data: [
        { userId: gardener.id, postId: created[0]!.id },
        { userId: neighbor.id, postId: created[0]!.id },
        { userId: gardener.id, postId: created[2]!.id },
      ],
      skipDuplicates: true,
    });
    await prisma.comment.create({
      data: { postId: created[0]!.id, userId: gardener.id, body: "The tiny wins are the best ones." },
    });
  }

  await prisma.follow.createMany({
    data: [
      { followerId: gardener.id, followingId: playlist.id },
      { followerId: gardener.id, followingId: neighbor.id },
      { followerId: playlist.id, followingId: gardener.id },
    ],
    skipDuplicates: true,
  });
  console.info("Seeded Commonroom guest profiles and synthetic community content.");
}

main()
  .catch((error: unknown) => {
    console.error("Commonroom database seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
