using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Karigor.Application.Payments.DTOs;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Karigor.Application.Payments.SslCommerz;

public class SslCommerzClient
{
    private readonly HttpClient _httpClient;
    private readonly SslCommerzOptions _options;
    private readonly ILogger<SslCommerzClient> _logger;

    public SslCommerzClient(
        HttpClient httpClient,
        IOptions<SslCommerzOptions> options,
        ILogger<SslCommerzClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<SslCommerzInitResponse> InitiateTransactionAsync(
        string transactionId,
        decimal totalAmount,
        decimal platformFee,
        int bookingId,
        int customerId,
        int workerId,
        string customerName,
        string customerEmail,
        string customerPhone,
        string customerAddress,
        string categoryName,
        string? customAppBaseUrl = null)
    {
        var appBaseUrl = !string.IsNullOrWhiteSpace(customAppBaseUrl)
            ? customAppBaseUrl.TrimEnd('/')
            : _options.AppBaseUrl.TrimEnd('/');

        var postData = new Dictionary<string, string>
        {
            ["store_id"]         = _options.StoreId,
            ["store_passwd"]     = _options.StorePassword,
            ["total_amount"]     = totalAmount.ToString("F2", CultureInfo.InvariantCulture),
            ["currency"]         = "BDT",
            ["tran_id"]          = transactionId,
            ["success_url"]      = $"{appBaseUrl}/api/payments/sslcommerz/success",
            ["fail_url"]         = $"{appBaseUrl}/api/payments/sslcommerz/fail",
            ["cancel_url"]       = $"{appBaseUrl}/api/payments/sslcommerz/cancel",
            ["ipn_url"]          = $"{appBaseUrl}/api/payments/sslcommerz/ipn",
            ["cus_name"]         = string.IsNullOrWhiteSpace(customerName) ? "Karigor Customer" : customerName,
            ["cus_email"]        = string.IsNullOrWhiteSpace(customerEmail) ? "customer@karigor.app" : customerEmail,
            ["cus_phone"]        = string.IsNullOrWhiteSpace(customerPhone) ? "01700000000" : customerPhone,
            ["cus_add1"]         = string.IsNullOrWhiteSpace(customerAddress) ? "Dhaka, Bangladesh" : customerAddress,
            ["cus_city"]         = "Dhaka",
            ["cus_country"]      = "Bangladesh",
            ["shipping_method"]  = "NO",
            ["num_of_item"]      = "1",
            ["product_name"]     = $"Karigor Service - Booking #{bookingId}",
            ["product_category"] = string.IsNullOrWhiteSpace(categoryName) ? "Service" : categoryName,
            ["product_profile"]  = "general",
            ["value_a"]          = bookingId.ToString(),
            ["value_b"]          = customerId.ToString(),
            ["value_c"]          = workerId.ToString(),
            ["value_d"]          = platformFee.ToString("F2", CultureInfo.InvariantCulture)
        };

        var initUrl = $"{_options.BaseUrl}/gwprocess/v4/api.php";
        _logger.LogInformation("Initiating SSLCommerz transaction {TransactionId} at {Url}", transactionId, initUrl);

        using var requestContent = new FormUrlEncodedContent(postData);
        var response = await _httpClient.PostAsync(initUrl, requestContent);
        var responseString = await response.Content.ReadAsStringAsync();

        try
        {
            var initResponse = JsonSerializer.Deserialize<SslCommerzInitResponse>(responseString, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            // Sandbox failover: if configured store credentials return "Store Credential Error Or Store is De-active",
            // retry with official SSLCommerz sandbox test store "testbox" / "qwerty" for local testing
            if (_options.IsSandbox && (initResponse == null || !string.Equals(initResponse.Status, "SUCCESS", StringComparison.OrdinalIgnoreCase))
                && (initResponse?.FailedReason?.Contains("Store Credential", StringComparison.OrdinalIgnoreCase) == true
                    || initResponse?.FailedReason?.Contains("De-active", StringComparison.OrdinalIgnoreCase) == true))
            {
                _logger.LogWarning("SSLCommerz credentials ({StoreId}) returned '{Reason}'. Retrying with sandbox test store 'testbox'...",
                    _options.StoreId, initResponse?.FailedReason);

                postData["store_id"] = "testbox";
                postData["store_passwd"] = "qwerty";

                using var retryContent = new FormUrlEncodedContent(postData);
                var retryResponse = await _httpClient.PostAsync(initUrl, retryContent);
                var retryResponseString = await retryResponse.Content.ReadAsStringAsync();

                initResponse = JsonSerializer.Deserialize<SslCommerzInitResponse>(retryResponseString, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
                responseString = retryResponseString;
            }

            if (initResponse == null || !string.Equals(initResponse.Status, "SUCCESS", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogError("SSLCommerz initialization failed for {TransactionId}: {Reason}. Raw: {Raw}",
                    transactionId, initResponse?.FailedReason ?? "Unknown error", responseString);
                throw new InvalidOperationException($"SSLCommerz session initialization failed: {initResponse?.FailedReason ?? "Gateway error"}");
            }

            return initResponse;
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse SSLCommerz response for {TransactionId}. Raw: {Raw}", transactionId, responseString);
            throw new InvalidOperationException("Failed to communicate with payment gateway.");
        }
    }

    public async Task<SslCommerzValidationResponse> ValidateTransactionAsync(string valId)
    {
        var validationUrl = $"{_options.BaseUrl}/validator/api/validationserverAPI.php?val_id={Uri.EscapeDataString(valId)}&store_id={Uri.EscapeDataString(_options.StoreId)}&store_passwd={Uri.EscapeDataString(_options.StorePassword)}&v=1&format=json";
        _logger.LogInformation("Validating SSLCommerz payment for val_id: {ValId}", valId);

        var response = await _httpClient.GetAsync(validationUrl);
        var responseString = await response.Content.ReadAsStringAsync();

        // If credentials failed in sandbox, retry with testbox
        if (_options.IsSandbox && (responseString.Contains("Store Credential Error", StringComparison.OrdinalIgnoreCase)
                                   || responseString.Contains("Store is De-active", StringComparison.OrdinalIgnoreCase)))
        {
            validationUrl = $"{_options.BaseUrl}/validator/api/validationserverAPI.php?val_id={Uri.EscapeDataString(valId)}&store_id=testbox&store_passwd=qwerty&v=1&format=json";
            response = await _httpClient.GetAsync(validationUrl);
            responseString = await response.Content.ReadAsStringAsync();
        }

        try
        {
            var validation = JsonSerializer.Deserialize<SslCommerzValidationResponse>(responseString, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (validation == null)
            {
                _logger.LogError("SSLCommerz returned empty validation response for val_id: {ValId}", valId);
                throw new InvalidOperationException("Invalid validation response from payment gateway.");
            }

            return validation;
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse SSLCommerz validation for {ValId}. Raw: {Raw}", valId, responseString);
            throw new InvalidOperationException("Failed to validate payment with gateway.");
        }
    }
}
