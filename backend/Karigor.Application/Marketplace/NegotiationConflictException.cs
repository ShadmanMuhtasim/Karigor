namespace Karigor.Application.Marketplace;

public sealed class NegotiationConflictException() : Exception(
    "The negotiation has changed or needs review. Refresh the current offer before trying again.");
