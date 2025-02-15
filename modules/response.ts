import {
  Chat,
  Chunk,
  Source,
  CoreMessage,
  AIProviders,
  ProviderName,
} from "@/types";
import {
  convertToCoreMessages,
  embedHypotheticalData,
  generateHypotheticalData,
  getSourcesFromChunks,
  searchForChunksUsingEmbedding,
  getContextFromSources,
  getLinksFromChunks,
  buildPromptFromContext,
} from "@/utilities/chat";
import { queueAssistantResponse, queueIndicator } from "@/actions/streaming";
import { HISTORY_CONTEXT_LENGTH, DEFAULT_RESPONSE_MESSAGE } from "@/config";
import { stripMessagesOfCitations } from "@/utilities/chat";
import {
  RESPOND_TO_HOSTILE_MESSAGE_SYSTEM_PROMPT,
  RESPOND_TO_RANDOM_MESSAGE_SYSTEM_PROMPT,
} from "@/prompts";

export class ResponseModule {
  static async respondToRandomMessage(
    chat: Chat,
    providers: AIProviders
  ): Promise<Response> {
    // Change provider/model name here
    const PROVIDER_NAME: ProviderName = "openai";
    const MODEL_NAME: string = "gpt-4o-mini";

    const stream = new ReadableStream({
      async start(controller) {
        queueIndicator({
          controller,
          status: "Coming up with an answer",
          icon: "thinking",
        });
        const systemPrompt = RESPOND_TO_RANDOM_MESSAGE_SYSTEM_PROMPT();
        const mostRecentMessages: CoreMessage[] = await convertToCoreMessages(
          stripMessagesOfCitations(chat.messages.slice(-HISTORY_CONTEXT_LENGTH))
        );

        const links: string[] = [];
        queueAssistantResponse({
          controller,
          providers,
          providerName: PROVIDER_NAME,
          messages: mostRecentMessages,
          model_name: MODEL_NAME,
          systemPrompt,
          links,
          error_message: DEFAULT_RESPONSE_MESSAGE,
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  static async respondToHostileMessage(
    chat: Chat,
    providers: AIProviders
  ): Promise<Response> {
    // Change provider/model name here
    const PROVIDER_NAME: ProviderName = "openai";
    const MODEL_NAME: string = "gpt-4o-mini";

    const stream = new ReadableStream({
      async start(controller) {
        queueIndicator({
          controller,
          status: "Coming up with an answer",
          icon: "thinking",
        });
        const systemPrompt = RESPOND_TO_HOSTILE_MESSAGE_SYSTEM_PROMPT();
        const links: string[] = [];
        queueAssistantResponse({
          controller,
          providers,
          providerName: PROVIDER_NAME,
          messages: [],
          model_name: MODEL_NAME,
          systemPrompt,
          links,
          error_message: DEFAULT_RESPONSE_MESSAGE,
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  static async respondToQuestion(
    chat: Chat,
    providers: AIProviders,
    index: any
  ): Promise<Response> {
    // Change provider/model name here
    const PROVIDER_NAME: ProviderName = "openai";
    const MODEL_NAME: string = "gpt-4o";

    const stream = new ReadableStream({
      async start(controller) {
        queueIndicator({
          controller,
          status: "Figuring out what your answer looks like",
          icon: "thinking",
        });
        const hypotheticalData: string = await generateHypotheticalData(
          chat,
          providers.openai
        );
        const { embedding }: { embedding: number[] } =
          await embedHypotheticalData(hypotheticalData, providers.openai);
        queueIndicator({
          controller,
          status: "Reading through documents",
          icon: "searching",
        });
        const chunks: Chunk[] = await searchForChunksUsingEmbedding(
          embedding,
          index
        );
        const sources: Source[] = await getSourcesFromChunks(chunks);
        queueIndicator({
          controller,
          status: `Read over ${sources.length} documents`,
          icon: "documents",
        });
        const links: string[] = await getLinksFromChunks(chunks);
        const contextFromSources = await getContextFromSources(sources);
        const systemPrompt = await buildPromptFromContext(contextFromSources);
        queueIndicator({
          controller,
          status: "Coming up with an answer",
          icon: "thinking",
        });
        queueAssistantResponse({
          controller,
          providers,
          providerName: PROVIDER_NAME,
          messages: stripMessagesOfCitations(
            chat.messages.slice(-HISTORY_CONTEXT_LENGTH)
          ),
          model_name: MODEL_NAME,
          systemPrompt,
          links,
          error_message: DEFAULT_RESPONSE_MESSAGE,
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }
}
