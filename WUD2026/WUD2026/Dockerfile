FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY WUD2026/WUD2026.csproj WUD2026/
RUN dotnet restore WUD2026/WUD2026.csproj
COPY WUD2026/ WUD2026/
RUN dotnet publish WUD2026/WUD2026.csproj -c Release -o /out --no-restore
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out .
RUN mkdir -p /app/keys && chown $APP_UID:$APP_UID /app/keys
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "WUD2026.dll"]
