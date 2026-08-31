export interface ToolContext {
  userId: string;
}

export interface Tool {
  name: string;
  description: string;
  execute(input: Record<string, any>, context?: ToolContext): Promise<any>;
}
