import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { user } from "../db/schema";
import { auth } from "../services/better-auth";

const ErrorSchema = z.object({
  error: z.string(),
});

const UpdateProfileRequestSchema = z
  .object({
    name: z.string().min(1).max(50).openapi({
      description: "Display name (1–50 characters)",
      example: "John Doe",
    }),
    bio: z.string().max(250).nullable().optional().openapi({
      description: "User bio (markdown, max 250 characters)",
      example: "Music lover and trivia enthusiast",
    }),
  })
  .openapi("UpdateProfileRequest");

const UserProfileSchema = z
  .object({
    id: z.string().openapi({ description: "User ID" }),
    name: z.string().openapi({ description: "Display name" }),
    email: z.string().openapi({ description: "Email address" }),
    image: z.string().nullable().openapi({ description: "Avatar image URL" }),
    bio: z.string().nullable().openapi({ description: "User bio (markdown)" }),
  })
  .openapi("UserProfile");

const AvatarUploadResponseSchema = z
  .object({
    imageUrl: z.string().openapi({ description: "Avatar image URL" }),
  })
  .openapi("AvatarUploadResponse");

const AvatarUploadRequestSchema = z.object({
  file: z.instanceof(File).openapi({
    description: "Avatar image file (jpeg, png, gif, or webp, max 2MB)",
  }),
});

const UserIdParamSchema = z.object({
  userId: z.string().openapi({
    param: { name: "userId", in: "path" },
    description: "User ID",
  }),
});

function createUserSettingsHandlers() {
  const app = new OpenAPIHono<{ Bindings: Env }>();

  const getAuthenticatedUser = async (c: { env: Env; req: { raw: Request } }) => {
    const authInstance = auth(c.env);
    const session = await authInstance.api.getSession(c.req.raw);
    return session?.user;
  };

  // PUT /profile - Update display name
  const updateProfileRoute = createRoute({
    method: "put",
    path: "/profile",
    request: {
      body: {
        content: { "application/json": { schema: UpdateProfileRequestSchema } },
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: UserProfileSchema } },
        description: "Profile updated successfully",
      },
      401: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Unauthorized",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "User not found",
      },
    },
    tags: ["User"],
    summary: "Update profile",
    description: "Update the authenticated user's display name and bio",
  });
  app.openapi(updateProfileRoute, async (c) => {
    const currentUser = await getAuthenticatedUser(c);
    if (!currentUser) return c.json({ error: "Unauthorized" }, 401);

    const { name, bio } = c.req.valid("json");
    const db = getDb(c.env.DATABASE_URL);

    const [updated] = await db
      .update(user)
      .set({ name, ...(bio !== undefined && { bio }) })
      .where(eq(user.id, currentUser.id))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        bio: user.bio,
      });

    if (!updated) return c.json({ error: "User not found" }, 404);

    return c.json(updated, 200);
  });

  // POST /avatar - Upload avatar image
  const avatarUploadRoute = createRoute({
    method: "post",
    path: "/avatar",
    request: {
      body: {
        content: {
          "multipart/form-data": { schema: AvatarUploadRequestSchema },
        },
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: AvatarUploadResponseSchema } },
        description: "Avatar uploaded successfully",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Bad request — invalid file or missing file",
      },
      401: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Unauthorized",
      },
    },
    tags: ["User"],
    summary: "Upload avatar",
    description: "Upload an avatar image (jpeg, png, gif, or webp, max 2MB)",
  });
  app.openapi(avatarUploadRoute, async (c) => {
    const currentUser = await getAuthenticatedUser(c);
    if (!currentUser) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.parseBody();
    const file = body["file"];

    if (!(file instanceof File)) {
      return c.json({ error: "File is required" }, 400);
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: "Invalid file type. Allowed: jpeg, png, gif, webp" }, 400);
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ error: "File too large. Maximum size is 2MB" }, 400);
    }

    const key = `avatars/${currentUser.id}`;

    await c.env.AVATAR_BUCKET.put(key, file, {
      httpMetadata: { contentType: file.type },
    });

    const imageUrl = `/api/user/avatar/${currentUser.id}`;
    const db = getDb(c.env.DATABASE_URL);
    await db.update(user).set({ image: imageUrl }).where(eq(user.id, currentUser.id));

    return c.json({ imageUrl }, 200);
  });

  // GET /avatar/{userId} - Serve any user's avatar (public, no auth)
  const avatarServeRoute = createRoute({
    method: "get",
    path: "/avatar/{userId}",
    request: { params: UserIdParamSchema },
    responses: {
      200: {
        description: "Avatar image",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Avatar not found",
      },
    },
    tags: ["User"],
    summary: "Get avatar",
    description: "Get any user's avatar image by user ID (public)",
  });
  app.openapi(avatarServeRoute, async (c) => {
    const { userId } = c.req.valid("param");
    const key = `avatars/${userId}`;

    const object = await c.env.AVATAR_BUCKET.get(key);
    if (!object) {
      return c.json({ error: "Avatar not found" }, 404);
    }

    const etag = object.httpEtag;
    const ifNoneMatch = c.req.raw.headers.get("If-None-Match");
    if (etag && ifNoneMatch === etag) {
      return new Response(null, { status: 304 });
    }

    const headers = new Headers();
    headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
    headers.set("Cache-Control", "private, no-cache");
    if (etag) headers.set("ETag", etag);
    headers.set("Content-Length", String(object.size));

    return new Response(object.body, { status: 200, headers });
  });

  return app;
}

export const userSettingsHandlers = createUserSettingsHandlers();
