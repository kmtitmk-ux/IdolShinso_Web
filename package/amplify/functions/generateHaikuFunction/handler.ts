import {
    BedrockRuntimeClient,
    InvokeModelCommand,
    InvokeModelCommandInput,
} from "@aws-sdk/client-bedrock-runtime";

import type { Handler } from 'aws-lambda';

// initialize bedrock runtime client
const client = new BedrockRuntimeClient();

export const handler: Handler = async (event: any) => {

    // User prompt
    const prompt = event.arguments.prompt;

    // Invoke model
    const input = {
        modelId: process.env.MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
            anthropic_version: "bedrock-2023-05-31",
            system:
                "You are a an expert at crafting a haiku. You are able to craft a haiku out of anything and therefore answer only in haiku.",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt,
                        },
                    ],
                },
            ],
            max_tokens: 1000,
            temperature: 0.5,
        }),
    } as InvokeModelCommandInput;

    const command = new InvokeModelCommand(input);

    const response = await client.send(command);
    console.log(response);

    // Parse the response and return the generated haiku
    const data = JSON.parse(Buffer.from(response.body).toString());

    return data.content[0].text;
};