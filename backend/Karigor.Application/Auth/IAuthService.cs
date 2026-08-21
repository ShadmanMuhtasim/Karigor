using Karigor.Application.Auth.DTOs;

namespace Karigor.Application.Auth;

public interface IAuthService
{
    Task<(AuthResultDto result, string rawRefreshToken)> RegisterCustomerAsync(RegisterCustomerDto dto);
    Task<(AuthResultDto result, string rawRefreshToken)> RegisterWorkerAsync(RegisterWorkerDto dto);
    Task<(AuthResultDto result, string rawRefreshToken)> LoginAsync(LoginDto dto);
    Task<(AuthResultDto result, string rawRefreshToken)> RefreshAsync(string rawRefreshToken);
    Task LogoutAsync(string rawRefreshToken);
}
