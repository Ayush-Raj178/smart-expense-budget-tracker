package com.smartexpense.userservice.service;

import javax.naming.NamingException;
import java.util.List;

public interface MxRecordResolver {

    List<String> resolve(String domain) throws NamingException;
}
