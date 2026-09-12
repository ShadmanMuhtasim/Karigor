namespace Karigor.Application.Payments.SslCommerz;

public class SslCommerzOptions
{
    public const string SectionName = "SslCommerz";

    public string StoreId { get; set; } = "ptkml6aa4a2bceea8b";

    public string StorePassword { get; set; } = "qwerty1234@";

    public bool IsSandbox { get; set; } = true;

    public string BaseUrl => IsSandbox
        ? "https://sandbox.sslcommerz.com"
        : "https://securepay.sslcommerz.com";

    /// <summary>
    /// The public base URL of the backend API used for SSLCommerz callbacks.
    /// In local development with ngrok, this should be set to the ngrok tunnel URL (e.g., https://abc.ngrok-free.app).
    /// </summary>
    public string AppBaseUrl { get; set; } = "http://localhost:5253";

    /// <summary>
    /// The client frontend URL where the user should be redirected after callback processing.
    /// </summary>
    public string ClientBaseUrl { get; set; } = "http://localhost:5173";
}
