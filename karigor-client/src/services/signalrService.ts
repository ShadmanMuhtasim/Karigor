import * as signalR from '@microsoft/signalr';
import { getAccessToken } from '../api/client';
import type { MessageDto } from '../api/messagingApi';
import type { NotificationDto } from '../api/notificationApi';

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private messageListeners: Array<(msg: MessageDto) => void> = [];
  private notificationListeners: Array<(notif: NotificationDto) => void> = [];
  private typingListeners: Array<(data: { bookingId: number; userId: string; isTyping: boolean }) => void> = [];
  private serviceRequestListeners: Array<(data: any) => void> = [];
  private quotationListeners: Array<(data: any) => void> = [];
  private reviewCreatedListeners: Array<(data: any) => void> = [];
  private reviewUpdatedListeners: Array<(data: any) => void> = [];
  private joinedBookings = new Set<number>();
  private connectionPromise: Promise<void> | null = null;

  public async startConnection(): Promise<void> {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    const token = getAccessToken();
    if (!token) return;

    this.connectionPromise = (async () => {
      try {
        if (this.connection) {
          try {
            await this.connection.stop();
          } catch {}
          this.connection = null;
        }

        const conn = new signalR.HubConnectionBuilder()
          .withUrl('/hubs/chat', {
            accessTokenFactory: () => getAccessToken() || '',
            skipNegotiation: false,
            transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
          })
          .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
          .configureLogging(signalR.LogLevel.Information)
          .build();

        conn.on('ReceiveMessage', (msg: MessageDto) => {
          this.messageListeners.forEach((listener) => {
            try {
              listener(msg);
            } catch (err) {
              console.error('Error in message listener:', err);
            }
          });
        });

        conn.on('ReceiveNotification', (notif: NotificationDto) => {
          this.notificationListeners.forEach((listener) => {
            try {
              listener(notif);
            } catch (err) {
              console.error('Error in notification listener:', err);
            }
          });
        });

        conn.on('UserTyping', (data: { bookingId: number; userId: string; isTyping: boolean }) => {
          this.typingListeners.forEach((listener) => {
            try {
              listener(data);
            } catch (err) {
              console.error('Error in typing listener:', err);
            }
          });
        });

        conn.on('ServiceRequestCreated', (data: any) => {
          this.serviceRequestListeners.forEach((listener) => {
            try {
              listener(data);
            } catch (err) {
              console.error('Error in service request listener:', err);
            }
          });
        });

        conn.on('QuotationUpdated', (data: any) => {
          this.quotationListeners.forEach((listener) => {
            try {
              listener(data);
            } catch (err) {
              console.error('Error in quotation listener:', err);
            }
          });
        });

        conn.on('ReviewCreated', (data: any) => {
          this.reviewCreatedListeners.forEach((listener) => {
            try {
              listener(data);
            } catch (err) {
              console.error('Error in review created listener:', err);
            }
          });
        });

        conn.on('ReviewUpdated', (data: any) => {
          this.reviewUpdatedListeners.forEach((listener) => {
            try {
              listener(data);
            } catch (err) {
              console.error('Error in review updated listener:', err);
            }
          });
        });

        conn.onreconnected(async () => {
          for (const bId of this.joinedBookings) {
            try {
              await conn.invoke('JoinBooking', bId);
            } catch {}
          }
        });

        await conn.start();
        this.connection = conn;

        // Rejoin any active bookings
        for (const bId of this.joinedBookings) {
          try {
            await conn.invoke('JoinBooking', bId);
          } catch (err) {
            console.warn(`Could not join room for booking #${bId}:`, err);
          }
        }
      } catch (err) {
        console.warn('SignalR connection failed:', err);
      } finally {
        this.connectionPromise = null;
      }
    })();

    return this.connectionPromise;
  }

  public async stopConnection(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch {}
      this.connection = null;
    }
    this.joinedBookings.clear();
  }

  public async joinBooking(bookingId: number): Promise<void> {
    this.joinedBookings.add(bookingId);

    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      await this.startConnection();
    }

    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      try {
        await this.connection.invoke('JoinBooking', bookingId);
      } catch (err) {
        console.warn('Error joining booking chat group:', err);
      }
    }
  }

  public async leaveBooking(bookingId: number): Promise<void> {
    this.joinedBookings.delete(bookingId);

    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      try {
        await this.connection.invoke('LeaveBooking', bookingId);
      } catch (err) {
        console.warn('Error leaving booking chat group:', err);
      }
    }
  }

  public async sendTyping(bookingId: number, isTyping: boolean): Promise<void> {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      try {
        await this.connection.invoke('SendTyping', bookingId, isTyping);
      } catch {}
    }
  }

  public onMessage(callback: (msg: MessageDto) => void): () => void {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter((cb) => cb !== callback);
    };
  }

  public onNotification(callback: (notif: NotificationDto) => void): () => void {
    this.notificationListeners.push(callback);
    return () => {
      this.notificationListeners = this.notificationListeners.filter((cb) => cb !== callback);
    };
  }

  public onTyping(callback: (data: { bookingId: number; userId: string; isTyping: boolean }) => void): () => void {
    this.typingListeners.push(callback);
    return () => {
      this.typingListeners = this.typingListeners.filter((cb) => cb !== callback);
    };
  }

  public onServiceRequestCreated(callback: (data: any) => void): () => void {
    this.serviceRequestListeners.push(callback);
    return () => {
      this.serviceRequestListeners = this.serviceRequestListeners.filter((cb) => cb !== callback);
    };
  }

  public onQuotationUpdated(callback: (data: any) => void): () => void {
    this.quotationListeners.push(callback);
    return () => {
      this.quotationListeners = this.quotationListeners.filter((cb) => cb !== callback);
    };
  }

  public onReviewCreated(callback: (data: any) => void): () => void {
    this.reviewCreatedListeners.push(callback);
    return () => {
      this.reviewCreatedListeners = this.reviewCreatedListeners.filter((cb) => cb !== callback);
    };
  }

  public onReviewUpdated(callback: (data: any) => void): () => void {
    this.reviewUpdatedListeners.push(callback);
    return () => {
      this.reviewUpdatedListeners = this.reviewUpdatedListeners.filter((cb) => cb !== callback);
    };
  }
}

export const signalRService = new SignalRService();
