package com.smartexpense.userservice.repository;

import com.smartexpense.userservice.entity.EmailOtpChallenge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EmailOtpChallengeRepository extends JpaRepository<EmailOtpChallenge, Long> {
    Optional<EmailOtpChallenge> findByChallengeKey(String challengeKey);
}
