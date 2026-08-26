using System.Collections.Generic;

namespace Karigor.Application.Reviews.DTOs;

public class WorkerReviewsSummaryDto
{
    public int WorkerId { get; set; }
    public double AverageRating { get; set; }
    public int TotalReviews { get; set; }
    public Dictionary<int, int> RatingDistribution { get; set; } = new();
    public List<ReviewDto> Reviews { get; set; } = new();
}
