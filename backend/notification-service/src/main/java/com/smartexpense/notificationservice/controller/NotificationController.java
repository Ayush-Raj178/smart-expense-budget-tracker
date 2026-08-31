package com.smartexpense.notificationservice.controller;

import com.smartexpense.notificationservice.dto.MessageResponse;
import com.smartexpense.notificationservice.dto.NotificationResponse;
import com.smartexpense.notificationservice.security.SecurityUtils;
import com.smartexpense.notificationservice.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<List<NotificationResponse>> listNotifications() {
        Long userId = SecurityUtils.getCurrentUserId();
        List<NotificationResponse> notifications = notificationService.listNotifications(userId);
        return ResponseEntity.ok(notifications);
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<NotificationResponse> markAsRead(@PathVariable Long id) {
        Long userId = SecurityUtils.getCurrentUserId();
        NotificationResponse response = notificationService.markAsRead(userId, id);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<MessageResponse> deleteNotification(@PathVariable Long id) {
        Long userId = SecurityUtils.getCurrentUserId();
        notificationService.deleteNotification(userId, id);
        return ResponseEntity.ok(new MessageResponse("Notification deleted successfully"));
    }
}
