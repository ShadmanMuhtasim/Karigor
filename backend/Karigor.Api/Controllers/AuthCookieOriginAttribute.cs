using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Karigor.Api.Controllers;

// Cookie mutations require both a non-simple request header and an explicit trusted Origin.
// SameSite alone is insufficient (a hostile sibling origin may still be same-site).
public sealed class AuthCookieOriginAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var request = context.HttpContext.Request;
        context.HttpContext.Response.Headers.CacheControl = "no-store";
        if (HttpMethods.IsGet(request.Method)) return;
        var config = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var allowed = config.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        var origin = request.Headers.Origin.ToString();
        var sameOrigin = $"{request.Scheme}://{request.Host}";
        if (request.Headers["X-Karigor-CSRF"] != "1" || string.IsNullOrEmpty(origin) || origin == "null" ||
            !(string.Equals(origin, sameOrigin, StringComparison.OrdinalIgnoreCase) ||
              allowed.Any(value => value != "*" && string.Equals(value.TrimEnd('/'), origin, StringComparison.OrdinalIgnoreCase))))
            context.Result = new StatusCodeResult(StatusCodes.Status403Forbidden);
    }
}
