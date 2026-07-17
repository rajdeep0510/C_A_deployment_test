import { prisma } from "./prisma";
import { deleteUser } from "./auth";

export async function deleteAcademyCascade(academyId: string) {
  const academy = await prisma.academies.findUnique({
    where: { id: academyId },
    select: { owner_id: true },
  });

  const coaches = await prisma.profiles.findMany({
    where: { academy_id: academyId },
    select: { id: true },
  });

  // Delete coaches (CASCADE on app_users removes their sessions/tokens/profile)
  for (const coach of coaches) {
    try {
      await deleteUser(coach.id);
    } catch {
      // already deleted or FK mismatch — continue
    }
  }

  await prisma.academies.delete({ where: { id: academyId } });

  if (academy?.owner_id) {
    try {
      await deleteUser(academy.owner_id);
    } catch {
      // already deleted
    }
  }
}
