# Build stage
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/notification-service-1.0.0.jar app.jar
COPY docker-entrypoint.sh .
RUN apk add --no-cache curl && chmod +x docker-entrypoint.sh
EXPOSE 8084
ENTRYPOINT ["/app/docker-entrypoint.sh"]
