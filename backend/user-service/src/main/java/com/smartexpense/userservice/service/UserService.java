package com.smartexpense.userservice.service;

import com.smartexpense.userservice.dto.LoginRequest;
import com.smartexpense.userservice.dto.LoginResponse;
import com.smartexpense.userservice.dto.UpdateProfileRequest;
import com.smartexpense.userservice.dto.UserResponse;
import com.smartexpense.userservice.entity.User;
import com.smartexpense.userservice.exception.InvalidCredentialsException;
import com.smartexpense.userservice.exception.UserNotFoundException;
import com.smartexpense.userservice.repository.UserRepository;
import com.smartexpense.userservice.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail().toLowerCase())
                .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new InvalidCredentialsException();
        }

        String token = jwtTokenProvider.generateToken(user.getId(), user.getEmail());

        return LoginResponse.builder()
                .message("Login successful")
                .token(token)
                .user(toUserResponse(user))
                .build();
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(UserNotFoundException::new);
        return toUserResponse(user);
    }

    @Transactional
    public UserResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(UserNotFoundException::new);
        user.setName(request.getName().trim());
        String phoneNumber = request.getPhoneNumber();
        user.setPhoneNumber(phoneNumber == null || phoneNumber.isBlank() ? null : phoneNumber.trim());
        return toUserResponse(userRepository.save(user));
    }

    private UserResponse toUserResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .phoneNumber(user.getPhoneNumber())
                .build();
    }
}
