export interface CurrentUser {
    id: string;
    email: string | null;
    phone: string | null;
    role: string;
}
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
