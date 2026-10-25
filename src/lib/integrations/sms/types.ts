export interface SmsProvider {
  id: string;
  // to: 국제 형식 (+77011234567)
  send(to: string, text: string): Promise<void>;
}
