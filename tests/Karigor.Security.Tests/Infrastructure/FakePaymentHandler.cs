using System.Net;
using System.Text;
using System.Text.Json;

namespace Karigor.Security.Tests.Infrastructure;

/// <summary>No socket-backed handler exists beneath this fake.</summary>
public sealed class FakePaymentHandler : HttpMessageHandler
{
    public int Calls { get; private set; }
    public int UnexpectedCalls { get; private set; }
    private string? response;
    private bool unavailable;
    private bool timeout;
    private HttpStatusCode responseStatus = HttpStatusCode.OK;
    private string expectedPath = "/validator/api/validationserverAPI.php";
    private HttpMethod expectedMethod = HttpMethod.Get;
    public Uri? LastRequestUri { get; private set; }
    public string? LastRequestBody { get; private set; }
    public void Reset()
    {
        Calls = 0; UnexpectedCalls = 0; response = null; unavailable = false; timeout = false;
        responseStatus = HttpStatusCode.OK; expectedPath = "/validator/api/validationserverAPI.php";
        expectedMethod = HttpMethod.Get; LastRequestUri = null; LastRequestBody = null;
    }
    public void SetUnavailable() => unavailable = true;
    public void SetTimeout() => timeout = true;
    public void SetResponse(string json, HttpStatusCode status = HttpStatusCode.OK)
    { response = json; responseStatus = status; }
    public void SetInitResponse(string json)
    { response = json; expectedMethod = HttpMethod.Post; expectedPath = "/gwprocess/v4/api.php"; }
    public void SetValidatedReceipt(string transaction, string currency = "BDT")
        => response = JsonSerializer.Serialize(new
        {
            status = "VALID", tran_id = transaction, val_id = "fixture-validation", amount = "1000.00",
            currency, bank_tran_id = "fixture-bank"
        });

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Calls++;
        LastRequestUri = request.RequestUri;
        LastRequestBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
        if ((!unavailable && !timeout && response is null) || request.Method != expectedMethod ||
            request.RequestUri?.AbsolutePath != expectedPath)
        {
            UnexpectedCalls++;
            throw new InvalidOperationException("Unexpected payment HTTP request: fake denies all unconfigured calls.");
        }
        if (unavailable) throw new HttpRequestException("Fixture provider unavailable; no network request was made.");
        if (timeout) throw new TaskCanceledException("Fixture provider timeout; no network request was made.");
        return new HttpResponseMessage(responseStatus)
        {
            Content = new StringContent(response!, Encoding.UTF8, "application/json")
        };
    }
}
