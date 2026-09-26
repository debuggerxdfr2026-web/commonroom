import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const demoPassword = "CommonroomDemo!2026";

async function main() {
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const people = [
    { email: "demo@commonroom.local", username: "commonroom_demo", name: "Maya Chen", bio: "Collecting little moments and big ideas. Usually near a window with good light." },
    { email: "jules@commonroom.local", username: "julesm", name: "Jules Morgan", bio: "Designer, weekend gardener, professional playlist sender." },
    { email: "imani@commonroom.local", username: "imanir", name: "Imani Rivers", bio: "Building community one thoughtful question at a time." },
    { email: "leo@commonroom.local", username: "leopark", name: "Leo Park", bio: "Photographer finding new corners of the city." },
    { email: "sana@commonroom.local", username: "sana.k", name: "Sana Kapoor", bio: "Making things with my hands and learning as I go." },
  ];
  const users = [];
  for (const person of people) {
    users.push(await prisma.user.upsert({
      where: { email: person.email },
      update: { username: person.username, name: person.name, bio: person.bio },
      create: { ...person, passwordHash },
    }));
  }
  const [maya, jules, imani, leo, sana] = users;
  if (!maya || !jules || !imani || !leo || !sana) throw new Error("Seed users could not be created.");

  const demoPosts = [
    { authorId: jules.id, body: "A slow Sunday, a full watering can, and one tiny new leaf. Sometimes that really is the whole plan. 🌱" },
    { authorId: imani.id, body: "What’s a small thing someone did for you recently that stayed with you? I’ll go first: my neighbor left a little bag of lemons at the door." },
    { authorId: leo.id, body: "Took the long way home and found this little pocket of quiet between the buildings. Making more room for detours lately." },
    { authorId: sana.id, body: "First try at making my own ceramics. It leans a little to the left and I love it anyway." },
  ];
  const postCount = await prisma.post.count({ where: { authorId: { in: users.map((user) => user.id) } } });
  if (postCount === 0) {
    const created = [];
    for (const post of demoPosts) created.push(await prisma.post.create({ data: post }));
    await prisma.like.createMany({
      data: [
        { userId: maya.id, postId: created[0]!.id },
        { userId: imani.id, postId: created[0]!.id },
        { userId: maya.id, postId: created[2]!.id },
      ],
      skipDuplicates: true,
    });
    await prisma.comment.create({
      data: { postId: created[0]!.id, userId: maya.id, body: "The tiny wins are the best ones." },
    });
  }

  await prisma.follow.createMany({
    data: [
      { followerId: maya.id, followingId: jules.id },
      { followerId: maya.id, followingId: imani.id },
      { followerId: jules.id, followingId: maya.id },
    ],
    skipDuplicates: true,
  });
  const conversationExists = await prisma.conversation.findFirst({
    where: { members: { some: { userId: maya.id } } },
  });
  if (!conversationExists) {
    await prisma.conversation.create({
      data: {
        members: { create: [{ userId: maya.id }, { userId: jules.id }] },
        messages: { create: [{ senderId: jules.id, body: "Hey Maya! So glad you made it in here 🌼" }] },
      },
    });
  }
  const hasNotification = await prisma.notification.findFirst({ where: { recipientId: maya.id } });
  if (!hasNotification) {
    await prisma.notification.create({
      data: { recipientId: maya.id, actorId: imani.id, type: "follow" },
    });
  }
  console.info("Seeded Commonroom demo accounts and community content.");
}

main()
  .catch((error: unknown) => {
    console.error("Commonroom database seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
