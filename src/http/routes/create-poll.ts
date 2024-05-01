import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

const createPollSchema = {
  body: {
    type: "object",
    required: ["title", "options"],
    properties: {
      title: { type: "string" },
      options: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
};

export async function createPoll(app: FastifyInstance) {
  app.post("/polls", { schema: createPollSchema }, async (request, reply) => {
    const createPollBody = z.object({
      title: z.string(),
      options: z.array(z.string()),
    });

    const { title, options } = createPollBody.parse(request.body);

    const poll = await prisma.poll.create({
      data: {
        title,
        options: {
          createMany: {
            data: options.map((option) => {
              return { title: option };
            }),
          },
        },
      },
    });

    return reply.code(201).send({ pollId: poll.id });
  });
}
