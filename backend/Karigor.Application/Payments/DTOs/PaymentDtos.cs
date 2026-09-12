using System;
using System.Text.Json.Serialization;

namespace Karigor.Application.Payments.DTOs;

public class InitiatePaymentRequestDto
{
    public int BookingId { get; set; }
}

public class InitiatePaymentResponseDto
{
    public string GatewayUrl { get; set; } = string.Empty;
    public string TransactionId { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public decimal PlatformFee { get; set; }
    public decimal ServiceCharge { get; set; }
    public decimal TotalFee => PlatformFee + ServiceCharge;
    public decimal WorkerAmount { get; set; }
}

public class PaymentDetailsDto
{
    public int Id { get; set; }
    public int BookingId { get; set; }
    public string TransactionId { get; set; } = string.Empty;
    public string? ValId { get; set; }
    public string? BankTranId { get; set; }
    public string? CardType { get; set; }
    public string Currency { get; set; } = "BDT";
    public decimal TotalAmount { get; set; }
    public decimal PlatformFee { get; set; }
    public decimal ServiceCharge { get; set; }
    public decimal TotalFee => PlatformFee + ServiceCharge;
    public decimal WorkerAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? PaidAt { get; set; }
}

public class SslCommerzInitResponse
{
    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("failedreason")]
    public string? FailedReason { get; set; }

    [JsonPropertyName("sessionkey")]
    public string? SessionKey { get; set; }

    [JsonPropertyName("GatewayPageURL")]
    public string? GatewayPageURL { get; set; }
}

public class SslCommerzValidationResponse
{
    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("tran_date")]
    public string? TranDate { get; set; }

    [JsonPropertyName("tran_id")]
    public string? TranId { get; set; }

    [JsonPropertyName("val_id")]
    public string? ValId { get; set; }

    [JsonPropertyName("amount")]
    public string? Amount { get; set; }

    [JsonPropertyName("store_amount")]
    public string? StoreAmount { get; set; }

    [JsonPropertyName("currency")]
    public string? Currency { get; set; }

    [JsonPropertyName("bank_tran_id")]
    public string? BankTranId { get; set; }

    [JsonPropertyName("card_type")]
    public string? CardType { get; set; }

    [JsonPropertyName("card_no")]
    public string? CardNo { get; set; }

    [JsonPropertyName("card_issuer")]
    public string? CardIssuer { get; set; }

    [JsonPropertyName("card_brand")]
    public string? CardBrand { get; set; }

    [JsonPropertyName("card_sub_brand")]
    public string? CardSubBrand { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }

    [JsonPropertyName("value_a")]
    public string? ValueA { get; set; } // BookingId

    [JsonPropertyName("value_b")]
    public string? ValueB { get; set; }

    [JsonPropertyName("value_c")]
    public string? ValueC { get; set; }

    [JsonPropertyName("value_d")]
    public string? ValueD { get; set; }
}

public class SslCommerzCallbackDto
{
    public string? TranId { get; set; }
    public string? tran_id { get => TranId; set => TranId = value; }

    public string? ValId { get; set; }
    public string? val_id { get => ValId; set => ValId = value; }

    public string? Amount { get; set; }
    public string? amount { get => Amount; set => Amount = value; }

    public string? CardType { get; set; }
    public string? card_type { get => CardType; set => CardType = value; }

    public string? StoreAmount { get; set; }
    public string? store_amount { get => StoreAmount; set => StoreAmount = value; }

    public string? BankTranId { get; set; }
    public string? bank_tran_id { get => BankTranId; set => BankTranId = value; }

    public string? Status { get; set; }
    public string? status { get => Status; set => Status = value; }

    public string? TranDate { get; set; }
    public string? tran_date { get => TranDate; set => TranDate = value; }

    public string? Currency { get; set; }
    public string? currency { get => Currency; set => Currency = value; }

    public string? CardIssuer { get; set; }
    public string? card_issuer { get => CardIssuer; set => CardIssuer = value; }

    public string? CardBrand { get; set; }
    public string? card_brand { get => CardBrand; set => CardBrand = value; }

    public string? ValueA { get; set; } // BookingId
    public string? value_a { get => ValueA; set => ValueA = value; }
}
