import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Starting seed...");

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
        where: { email: "farhad@tournest.com" },
    });

    if (existingAdmin) {
        console.log("✅ Admin user already exists!");
        return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash("123456", 12);

    await prisma.$transaction(async (tx) => {
        // Create user
        await tx.user.create({
            data: {
                email: "farhad@tournest.com",
                password: hashedPassword,
                role: UserRole.ADMIN,
                needPasswordChange: false,
                status: UserStatus.ACTIVE,
            },
        });

        // Create admin profile
        await tx.admin.create({
            data: {
                email: "farhad@tournest.com",
                name: "Farhad Hossen",
                contactNumber: "+880123456789",
            },
        });
    });

    console.log("✅ Admin user created successfully!");
    console.log("📧 Email: farhad@tournest.com");
    console.log("🔑 Password: 123456");
}

main()
    .catch((e) => {
        console.error("❌ Error seeding database:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
