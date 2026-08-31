package com.smartexpense.userservice.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.naming.Context;
import javax.naming.NamingEnumeration;
import javax.naming.NamingException;
import javax.naming.directory.Attribute;
import javax.naming.directory.Attributes;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;
import java.util.ArrayList;
import java.util.Hashtable;
import java.util.List;

@Component
public class JndiMxRecordResolver implements MxRecordResolver {

    private final int timeoutMilliseconds;
    private final int retries;

    public JndiMxRecordResolver(
            @Value("${app.email-validation.dns-timeout-ms:2500}") int timeoutMilliseconds,
            @Value("${app.email-validation.dns-retries:1}") int retries) {
        this.timeoutMilliseconds = timeoutMilliseconds;
        this.retries = retries;
    }

    @Override
    public List<String> resolve(String domain) throws NamingException {
        Hashtable<String, String> environment = new Hashtable<>();
        environment.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.dns.DnsContextFactory");
        environment.put("com.sun.jndi.dns.timeout.initial", String.valueOf(timeoutMilliseconds));
        environment.put("com.sun.jndi.dns.timeout.retries", String.valueOf(retries));

        DirContext context = null;
        try {
            context = new InitialDirContext(environment);
            Attributes attributes = context.getAttributes(domain, new String[]{"MX"});
            Attribute mxAttribute = attributes.get("MX");
            if (mxAttribute == null) {
                return List.of();
            }

            List<String> exchanges = new ArrayList<>();
            NamingEnumeration<?> records = mxAttribute.getAll();
            try {
                while (records.hasMore()) {
                    String record = String.valueOf(records.next()).trim();
                    String[] parts = record.split("\\s+");
                    if (parts.length > 0) {
                        exchanges.add(parts[parts.length - 1]);
                    }
                }
            } finally {
                records.close();
            }
            return exchanges;
        } finally {
            if (context != null) {
                try {
                    context.close();
                } catch (NamingException ignored) {
                    // The lookup result or original lookup error is more useful than a close failure.
                }
            }
        }
    }
}
